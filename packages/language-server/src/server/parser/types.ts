import type { IntervalSet } from "antlr4ng";
import type { Diagnostic } from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";

export interface SyntaxContext {
    expectedTokenSet: IntervalSet;
    ruleStack: number[];
    offset: number;
}

export interface ParseResult<Tree = unknown, Context extends SyntaxContext = SyntaxContext> {
    diagnostics: Diagnostic[];
    completionContexts: Context[];
    tree: Tree;
}

export interface ParsedDocument<Result extends ParseResult = ParseResult> {
    result: Result;
}

export interface ParserAdapter<Parsed extends ParsedDocument = ParsedDocument> {
    readonly id: string;

    supports(document: TextDocument): boolean;

    parse(document: TextDocument): Parsed;

    collectCompletionContext(parsed: Parsed, cursorOffset: number): SyntaxContext | null;
}
