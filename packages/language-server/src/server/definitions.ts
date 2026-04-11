import {
    type Location,
    type Position,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import {
    analyzeVariableScopes,
    findVariableOccurrenceAtOffset,
    type JsoniqVariableScopeAnalysis,
} from "./analysis.js";

interface CachedAnalysis {
    version: number;
    analysis: JsoniqVariableScopeAnalysis;
}

const analysisCache = new Map<string, CachedAnalysis>();

export function findDefinitionLocation(document: TextDocument, position: Position): Location | null {
    const analysis = getAnalysis(document);
    const offset = document.offsetAt(position);
    const occurrence = findVariableOccurrenceAtOffset(analysis, offset);

    if (occurrence === undefined) {
        return null;
    }

    return {
        uri: document.uri,
        range: occurrence.declaration.selectionRange,
    };
}

function getAnalysis(document: TextDocument): JsoniqVariableScopeAnalysis {
    const cached = analysisCache.get(document.uri);

    if (cached !== undefined && cached.version === document.version) {
        return cached.analysis;
    }

    const analysis = analyzeVariableScopes(document);

    analysisCache.set(document.uri, {
        version: document.version,
        analysis,
    });

    return analysis;
}
