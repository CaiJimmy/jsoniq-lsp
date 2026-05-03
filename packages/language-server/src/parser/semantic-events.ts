import type { Range } from "vscode-languageserver";

import type { SourceDefinitionKind } from "../analysis/model.js";

export type SemanticEvent =
    | SemanticScopeEvent
    | SemanticEnterDeclarationEvent
    | SemanticExitDeclarationEvent
    | SemanticReferenceEvent;

export type ScopeKind = "function" | "flowr";

export interface SemanticScopeEvent {
    type: "enterScope" | "exitScope";
    range: Range;
    scopeKind: ScopeKind;
}

export interface SemanticDeclaration {
    name: string;
    kind: SourceDefinitionKind;
    range: Range;
    selectionRange: Range;
}

export interface SemanticEnterDeclarationEvent {
    type: "enterDeclaration";
    declaration: SemanticDeclaration;
}

export interface SemanticExitDeclarationEvent {
    type: "exitDeclaration";
    declaration: SemanticDeclaration;
}

export interface SemanticReferenceEvent {
    type: "reference";
    name: string;
    kind: "variable" | "function";
    range: Range;
}
