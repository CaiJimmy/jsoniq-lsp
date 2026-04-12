import {
    DiagnosticSeverity,
    type Diagnostic,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { getAnalysis } from "./analysis.js";

export function collectSemanticDiagnostics(document: TextDocument): Diagnostic[] {
    const analysis = getAnalysis(document);
    const diagnostics: Diagnostic[] = [];

    for (const reference of analysis.references) {
        if (reference.declaration !== undefined) {
            continue;
        }

        diagnostics.push({
            severity: DiagnosticSeverity.Error,
            range: reference.range,
            message: `Unresolved variable reference '${reference.name}'.`,
            source: "jsoniq-semantic",
        });
    }

    return diagnostics;
}
