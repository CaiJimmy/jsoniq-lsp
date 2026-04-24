import {
    BaseErrorListener,
    CharStream,
    CommonTokenStream,
    type ATNSimulator,
    IntervalSet,
    type RecognitionException,
    type Recognizer,
    Token,
} from "antlr4ng";
import { CodeCompletionCore } from "antlr4-c3";
import {
    Diagnostic,
    DiagnosticSeverity,
    type Range,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { jsoniqLexer } from "../../../grammar/jsoniqLexer.js";
import { jsoniqParser, type ModuleAndThisIsItContext } from "../../../grammar/jsoniqParser.js";
import type { ParsedDocument, ParserAdapter, ParseResult, SyntaxContext } from "../types.js";
import { lowerBound } from "../../utils/binary-search.js";

export type JsoniqSyntaxContext = SyntaxContext;

export type JsoniqParseResult = ParseResult<ModuleAndThisIsItContext, JsoniqSyntaxContext>;

export interface JsoniqParsedDocument extends ParsedDocument<JsoniqParseResult> {
    parser: jsoniqParser;
    tokens: Token[];
    result: JsoniqParseResult;
}

class JsoniqErrorListener extends BaseErrorListener {
    public readonly diagnostics: Diagnostic[] = [];
    public readonly contexts: JsoniqSyntaxContext[] = [];

    public constructor(private readonly document: TextDocument) {
        super();
    }

    public override syntaxError<S extends Token, T extends ATNSimulator>(
        recognizer: Recognizer<T>,
        offendingSymbol: S | null,
        line: number,
        column: number,
        message: string,
        _error: RecognitionException | null,
    ): void {
        const range = this.createRange(offendingSymbol, line, column);

        if (recognizer instanceof jsoniqParser) {
            try {
                const offset = this.document.offsetAt(range.start);
                this.contexts.push({
                    offset,
                    expectedTokenSet: recognizer.getExpectedTokens(),
                    ruleStack: toParserRuleStack(recognizer, recognizer.getRuleInvocationStack()),
                });
            } catch {
                // The parser can be in an invalid state after a complete parse; diagnostics still matter.
            }
        }

        this.diagnostics.push({
            severity: DiagnosticSeverity.Error,
            range,
            message,
            source: "jsoniq",
        });
    }

    private createRange(offendingSymbol: Token | null, line: number, column: number): Range {
        if (offendingSymbol !== null && offendingSymbol.start >= 0 && offendingSymbol.stop >= offendingSymbol.start) {
            return {
                start: this.document.positionAt(offendingSymbol.start),
                end: this.document.positionAt(offendingSymbol.stop + 1),
            };
        }

        const startOffset = this.document.offsetAt({
            line: Math.max(line - 1, 0),
            character: Math.max(column, 0),
        });
        const endOffset = Math.min(startOffset + 1, this.document.getText().length);

        return {
            start: this.document.positionAt(startOffset),
            end: this.document.positionAt(endOffset),
        };
    }
}

export const jsoniqParserAdapter: ParserAdapter<JsoniqParsedDocument> = {
    id: "jsoniq",
    supports: () => true,
    parse: parseJsoniq,
    collectCompletionContext,
};

function parseJsoniq(document: TextDocument): JsoniqParsedDocument {
    const { lexer, parser, tokenStream } = createParser(document.getText());
    const errorListener = new JsoniqErrorListener(document);

    lexer.removeErrorListeners();
    parser.removeErrorListeners();
    lexer.addErrorListener(errorListener);
    parser.addErrorListener(errorListener);

    const tree = parser.moduleAndThisIsIt();

    tokenStream.fill();

    return {
        parser,
        tokens: tokenStream.getTokens(),
        result: {
            diagnostics: errorListener.diagnostics,
            completionContexts: errorListener.contexts,
            tree,
        },
    };
}

function collectCompletionContext(parsed: JsoniqParsedDocument, cursorOffset: number): JsoniqSyntaxContext | null {
    const caret = findCaretToken(parsed.tokens, cursorOffset);
    const tokenTypes = getCompletionTokenTypes(parsed.parser, caret.tokenIndex);
    const context = closestCompletionContext(parsed.result.completionContexts, cursorOffset);
    const ruleStack = context?.ruleStack ?? [];

    if (tokenTypes.length === 0) {
        if (context === null) {
            return null;
        }

        return {
            expectedTokenSet: context.expectedTokenSet,
            ruleStack: context.ruleStack,
            offset: context.offset,
        };
    }

    return {
        expectedTokenSet: new IntervalSet([...tokenTypes]),
        ruleStack,
        offset: context?.offset ?? cursorOffset,
    };
}

function createParser(source: string): { lexer: jsoniqLexer; parser: jsoniqParser; tokenStream: CommonTokenStream } {
    const input = CharStream.fromString(source);
    const lexer = new jsoniqLexer(input);
    const tokenStream = new CommonTokenStream(lexer);
    const parser = new jsoniqParser(tokenStream);

    return { lexer, parser, tokenStream };
}

function toParserRuleStack(parser: jsoniqParser, ruleNames: string[]): number[] {
    return ruleNames
        .map((ruleName) => parser.getRuleIndex(ruleName))
        .filter((ruleIndex) => ruleIndex >= 0);
}

function closestCompletionContext(
    contexts: JsoniqSyntaxContext[],
    cursorOffset: number,
): JsoniqSyntaxContext | null {
    if (contexts.length === 0) {
        return null;
    }

    const insertionPoint = lowerBound(contexts, cursorOffset, (context, target) => context.offset - target);
    const before = contexts[insertionPoint - 1];
    const after = contexts[insertionPoint];

    if (before === undefined) {
        return after!;
    }
    if (after === undefined) {
        return before;
    }

    return Math.abs(before.offset - cursorOffset) <= Math.abs(after.offset - cursorOffset)
        ? before
        : after;
}

function getCompletionTokenTypes(parser: jsoniqParser, caretTokenIndex: number): number[] {
    const core = new CodeCompletionCore(parser);
    core.ignoredTokens = IGNORED_COMPLETION_TOKENS;

    const candidates = core.collectCandidates(caretTokenIndex);
    return [...candidates.tokens.keys()].filter((tokenType) => tokenType !== Token.EOF);
}

function findCaretToken(tokens: Token[], cursorOffset: number): { tokenIndex: number; offset: number } {
    if (tokens.length === 0) {
        return { tokenIndex: 0, offset: cursorOffset };
    }

    const insertionPoint = lowerBound(tokens, cursorOffset, (token, target) => token.start - target);
    let tokenIndex = tokens[tokens.length - 1]!.tokenIndex;

    if (insertionPoint > 0) {
        const token = tokens[insertionPoint - 1]!;
        if (token.type !== Token.EOF && token.start <= cursorOffset && cursorOffset <= token.stop + 1) {
            tokenIndex = token.tokenIndex;
        } else if (insertionPoint < tokens.length) {
            tokenIndex = tokens[insertionPoint]!.tokenIndex;
        }
    } else if (insertionPoint < tokens.length) {
        tokenIndex = tokens[insertionPoint]!.tokenIndex;
    }

    for (let index = tokenIndex; index >= 0; index -= 1) {
        const token = tokens[index]!;
        if (token.type !== Token.EOF && (token.channel ?? Token.DEFAULT_CHANNEL) === Token.DEFAULT_CHANNEL) {
            return {
                tokenIndex,
                offset: Math.min(cursorOffset, token.stop + 1),
            };
        }
    }

    return { tokenIndex, offset: cursorOffset };
}

const IGNORED_COMPLETION_TOKENS = new Set([
    jsoniqParser.ArgumentPlaceholder,
    jsoniqParser.Kplus,
    jsoniqParser.Kminus,
    jsoniqParser.Kasterisk,
    jsoniqParser.Kdiv,
    jsoniqParser.Klparen,
    jsoniqParser.Krparen,
    jsoniqParser.Klbrace,
    jsoniqParser.Krbrace,
    jsoniqParser.Kobject_start,
    jsoniqParser.Kobject_end,
    jsoniqParser.Klbracket,
    jsoniqParser.Krbracket,
    jsoniqParser.Kannotation,
    jsoniqParser.Kdot,
    jsoniqParser.Kbang,
    jsoniqParser.Kequal,
    jsoniqParser.Kor,
    jsoniqParser.Knot,
    jsoniqParser.Kless,
    jsoniqParser.Kless_or_equal,
    jsoniqParser.Kgreater,
    jsoniqParser.Kgreater_or_equal,
    jsoniqParser.Kcomma,
]);
