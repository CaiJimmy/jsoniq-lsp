import type { SemanticEvent } from "./semantic-events.js";
import type { Diagnostic } from "vscode-languageserver";

export interface ParseResult {
    diagnostics: Diagnostic[];
    semanticEvents: readonly SemanticEvent[];
}