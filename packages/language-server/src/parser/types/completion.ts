export interface ParserKeywordCompletion {
    label: string;
    insertText?: string;
}

export interface CompletionIntent {
    allowVariableReferences: boolean;
    allowVariableDeclarations: boolean;
    allowFunctions: boolean;
    keywords: ParserKeywordCompletion[];
}
