import { ParserRuleContext, TerminalNode, type ParseTree } from "antlr4ng";
import { type Range } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import {
    CountClauseContext,
    FlowrExprContext,
    FlowrStatementContext,
    ForVarContext,
    FunctionDeclContext,
    GroupByVarContext,
    LetVarContext,
    ParamContext,
    VarDeclContext,
    VarRefContext,
} from "../grammar/jsoniqParser.js";
import { parseJsoniqDocument } from "./parser.js";

export type VariableDeclarationKind =
    | "declare-variable"
    | "let"
    | "for"
    | "for-position"
    | "group-by"
    | "count"
    | "parameter";

export interface VariableDeclaration {
    name: string;
    kind: VariableDeclarationKind;
    node: ParseTree;
    range: Range;
    selectionRange: Range;
}

export interface VariableReference {
    name: string;
    node: VarRefContext;
    range: Range;
    declaration: VariableDeclaration | undefined;
}

export interface VariableOccurrenceIndexEntry {
    startOffset: number;
    endOffset: number;
    declaration: VariableDeclaration;
    reference: VariableReference | undefined;
}

export interface JsoniqVariableScopeAnalysis {
    declarations: VariableDeclaration[];
    references: VariableReference[];
    referencesByDeclaration: Map<VariableDeclaration, VariableReference[]>;
    occurrenceIndex: VariableOccurrenceIndexEntry[];
}

interface ScopeFrame {
    declarationsByName: Map<string, VariableDeclaration>;
}

export function analyzeVariableScopes(document: TextDocument): JsoniqVariableScopeAnalysis {
    const parseResult = parseJsoniqDocument(document);
    const declarations: VariableDeclaration[] = [];
    const references: VariableReference[] = [];
    const referencesByDeclaration = new Map<VariableDeclaration, VariableReference[]>();
    const occurrenceIndex: VariableOccurrenceIndexEntry[] = [];
    const scopeStack: ScopeFrame[] = [{ declarationsByName: new Map() }];

    const pushScope = (): void => {
        scopeStack.push({ declarationsByName: new Map() });
    };

    const popScope = (): void => {
        if (scopeStack.length > 1) {
            scopeStack.pop();
        }
    };

    const currentScope = (): ScopeFrame => {
        const scope = scopeStack[scopeStack.length - 1];
        if (scope === undefined) {
            throw new Error("Variable scope stack is unexpectedly empty.");
        }
        return scope;
    };

    const declare = (declaration: VariableDeclaration): void => {
        declarations.push(declaration);
        currentScope().declarationsByName.set(declaration.name, declaration);
        referencesByDeclaration.set(declaration, []);
        const declarationOffsets = offsetsFromRange(declaration.selectionRange, document);
        occurrenceIndex.push({
            startOffset: declarationOffsets.startOffset,
            endOffset: declarationOffsets.endOffset,
            declaration,
            reference: undefined,
        });
    };

    const resolve = (name: string): VariableDeclaration | undefined => {
        for (let index = scopeStack.length - 1; index >= 0; index -= 1) {
            const scope = scopeStack[index];
            if (scope === undefined) {
                continue;
            }
            const declaration = scope.declarationsByName.get(name);
            if (declaration !== undefined) {
                return declaration;
            }
        }
        return undefined;
    };

    const visit = (node: ParseTree): void => {
        if (node instanceof FunctionDeclContext || node instanceof FlowrExprContext || node instanceof FlowrStatementContext) {
            pushScope();
        }

        if (node instanceof ParamContext) {
            declare(createParameterDeclaration(node, document));
        }

        if (node instanceof CountClauseContext) {
            const varRef = node.varRef();
            declare(createVariableDeclaration(varRefName(varRef), "count", node, varRef, document));
        }

        if (node instanceof VarRefContext && !isDeclarationVarRef(node)) {
            const name = varRefName(node);
            const declaration = resolve(name);
            const reference = {
                name: varRefName(node),
                node,
                range: rangeFromNode(node, document),
                declaration,
            } satisfies VariableReference;

            references.push(reference);

            if (declaration !== undefined) {
                const declarationReferences = referencesByDeclaration.get(declaration);
                if (declarationReferences !== undefined) {
                    declarationReferences.push(reference);
                }

                const referenceOffsets = offsetsFromRange(reference.range, document);
                occurrenceIndex.push({
                    startOffset: referenceOffsets.startOffset,
                    endOffset: referenceOffsets.endOffset,
                    declaration,
                    reference,
                });
            }
        }

        for (let index = 0; index < node.getChildCount(); index += 1) {
            const child = node.getChild(index);
            if (child !== null) {
                visit(child);
            }
        }

        if (node instanceof VarDeclContext) {
            const varRef = node.varRef();
            declare(createVariableDeclaration(varRefName(varRef), "declare-variable", node, varRef, document));
        }

        if (node instanceof LetVarContext) {
            const varRef = node.varRef();
            declare(createVariableDeclaration(varRefName(varRef), "let", node, varRef, document));
        }

        if (node instanceof ForVarContext) {
            const variableRefs = node.varRef();
            const boundVariable = variableRefs[0];
            if (boundVariable !== undefined) {
                declare(createVariableDeclaration(varRefName(boundVariable), "for", node, boundVariable, document));
            }
            const positionVariable = variableRefs[1];
            if (positionVariable !== undefined) {
                declare(createVariableDeclaration(varRefName(positionVariable), "for-position", node, positionVariable, document));
            }
        }

        if (node instanceof GroupByVarContext) {
            const varRef = node.varRef();
            declare(createVariableDeclaration(varRefName(varRef), "group-by", node, varRef, document));
        }

        if (node instanceof FunctionDeclContext || node instanceof FlowrExprContext || node instanceof FlowrStatementContext) {
            popScope();
        }
    };

    visit(parseResult.tree);

    occurrenceIndex.sort((left, right) => {
        if (left.startOffset === right.startOffset) {
            return left.endOffset - right.endOffset;
        }
        return left.startOffset - right.startOffset;
    });

    return {
        declarations,
        references,
        referencesByDeclaration,
        occurrenceIndex,
    };
}

function createParameterDeclaration(node: ParamContext, document: TextDocument): VariableDeclaration {
    const nameNode = node.qname();
    const selectionRange = rangeFromNode(nameNode, document);
    const declarationRange = {
        start: selectionRange.start,
        end: selectionRange.end,
    };

    return {
        name: `$${nameNode.getText()}`,
        kind: "parameter",
        node,
        range: declarationRange,
        selectionRange,
    };
}

function createVariableDeclaration(
    name: string,
    kind: VariableDeclarationKind,
    declarationNode: ParserRuleContext,
    selectionNode: ParseTree,
    document: TextDocument,
): VariableDeclaration {
    return {
        name,
        kind,
        node: declarationNode,
        range: rangeFromNode(declarationNode, document),
        selectionRange: rangeFromNode(selectionNode, document),
    };
}

export function findVariableOccurrenceAtOffset(
    analysis: JsoniqVariableScopeAnalysis,
    offset: number,
): VariableOccurrenceIndexEntry | undefined {
    const { occurrenceIndex } = analysis;
    let low = 0;
    let high = occurrenceIndex.length - 1;

    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const occurrence = occurrenceIndex[mid];

        if (occurrence === undefined) {
            break;
        }

        if (offset < occurrence.startOffset) {
            high = mid - 1;
            continue;
        }

        if (offset >= occurrence.endOffset) {
            low = mid + 1;
            continue;
        }

        return occurrence;
    }

    return undefined;
}

function offsetsFromRange(range: Range, document: TextDocument): {
    startOffset: number;
    endOffset: number;
} {
    const startOffset = document.offsetAt(range.start);
    const endOffset = document.offsetAt(range.end);

    return {
        startOffset,
        endOffset: Math.max(endOffset, startOffset),
    };
}

function varRefName(node: VarRefContext): string {
    return `$${node.qname().getText()}`;
}

function isDeclarationVarRef(node: VarRefContext): boolean {
    const parent = node.parent;

    if (parent instanceof VarDeclContext || parent instanceof LetVarContext || parent instanceof GroupByVarContext || parent instanceof CountClauseContext) {
        return parent.varRef() === node;
    }

    if (parent instanceof ForVarContext) {
        return parent.varRef().some((entry) => entry === node);
    }

    return false;
}

function rangeFromNode(node: ParserRuleContext | ParseTree, document: TextDocument): Range {
    if (node instanceof TerminalNode) {
        return {
            start: document.positionAt(Math.max(node.symbol.start, 0)),
            end: document.positionAt(Math.max(node.symbol.stop + 1, node.symbol.start)),
        };
    }

    if (node instanceof ParserRuleContext && node.start !== null) {
        const start = node.start.start;
        const stop = node.stop?.stop ?? node.start.stop;

        return {
            start: document.positionAt(Math.max(start, 0)),
            end: document.positionAt(Math.max(stop + 1, start)),
        };
    }

    const interval = node.getSourceInterval();
    const start = Math.max(interval.start, 0);
    const stop = Math.max(interval.stop, start);

    return {
        start: document.positionAt(start),
        end: document.positionAt(stop + 1),
    };
}
