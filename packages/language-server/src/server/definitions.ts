import {
    type Location,
    type Position,
} from "vscode-languageserver";
import { DocumentUri, TextDocument } from "vscode-languageserver-textdocument";

import {
    analyzeVariableScopes,
    findVariableOccurrenceAtOffset,
    type JsoniqVariableScopeAnalysis,
} from "./analysis.js";

/**
 * Cached analysis results for documents, keyed by document URI and version, 
 * Used to avoid redundant analysis when the same document is queried multiple times without changes
 */
interface CachedAnalysis {
    version: number;
    analysis: JsoniqVariableScopeAnalysis;
}

/** In memory cache for analysis results */
const analysisCache = new Map<DocumentUri, CachedAnalysis>();

/**
 * Finds the definition location for the variable at the given position in the document, by analyzing variable scopes and occurrences.
 * 
 * @param document The TextDocument representing the JSONiq source code to analyze
 * @param position The Position in the document for which to find the definition location (e.g. the position of the cursor in the editor)
 * @returns A Location object representing the definition location of the variable at the given position, or null if no definition is found
 */
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

/**
 * Retrieves the variable scope analysis for the given document, using a cache to avoid redundant analysis when possible.
 * If the analysis for the document is not in the cache or is outdated (i.e. the document version has changed), it performs a new analysis and updates the cache.
 * This is used to optimize performance when finding definition locations, as analyzing variable scopes can be an expensive operation.
 * 
 * @param document The TextDocument representing the JSONiq source code to analyze
 * @returns The JsoniqVariableScopeAnalysis object containing the results of variable scope analysis for the given document
 */
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
