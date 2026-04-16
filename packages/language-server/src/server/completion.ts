import {
    CompletionItemKind,
    type CompletionItem,
    type Position,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { type Definition, getVisibleDeclarationsAtPosition } from "./analysis.js";

export function findVariableCompletions(document: TextDocument, position: Position): CompletionItem[] {
    const visibleDeclarations = getVisibleDeclarationsAtPosition(document, position);

    return visibleDeclarations
        .map(toCompletionCandidate)
        .sort((left, right) => left.label.localeCompare(right.label))
        .map((candidate, index) => ({
            label: candidate.label,
            kind: candidate.kind,
            detail: candidate.detail,
            sortText: `${index.toString().padStart(5, "0")}:${candidate.label}`,
        }));
}

interface CompletionCandidate {
    label: string;
    kind: CompletionItemKind;
    detail: string;
}

function toCompletionCandidate(declaration: Definition): CompletionCandidate {
    if (declaration.kind === "function") {
        const [name, arity] = declaration.name.split("#", 2);
        return {
            label: name ?? declaration.name,
            kind: CompletionItemKind.Function,
            detail: arity === undefined ? "JSONiq function" : `JSONiq function/${arity}`,
        };
    }

    return {
        label: declaration.name,
        kind: CompletionItemKind.Variable,
        detail: `JSONiq ${declaration.kind}`,
    };
}
