import {
    TextDocumentSyncKind,
    createConnection,
    ProposedFeatures,
    TextDocuments,
    type InitializeParams,
    type InitializeResult,
} from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";

import { collectSyntaxDiagnostics } from "./parser.js";
import { collectDocumentSymbols } from "./symbols.js";
import { findDefinitionLocation } from "./definitions.js";

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

async function refreshDiagnostics(uri: string): Promise<void> {
    const document = documents.get(uri);

    if (document === undefined) {
        return;
    }

    connection.sendDiagnostics({
        uri: document.uri,
        diagnostics: collectSyntaxDiagnostics(document),
    });
}

connection.onInitialize((_params: InitializeParams): InitializeResult => ({
    capabilities: {
        textDocumentSync: TextDocumentSyncKind.Incremental,
        documentSymbolProvider: true,
        definitionProvider: true,
    },
    serverInfo: {
        name: "jsoniq-lsp",
        version: "0.1.0",
    },
}));

connection.onDocumentSymbol((params) => {
    const document = documents.get(params.textDocument.uri);

    if (document === undefined) {
        return [];
    }

    return collectDocumentSymbols(document);
});

connection.onDefinition((params) => {
    const document = documents.get(params.textDocument.uri);

    if (document === undefined) {
        return null;
    }

    return findDefinitionLocation(document, params.position);
});

documents.onDidOpen(async (event) => {
    await refreshDiagnostics(event.document.uri);
});

documents.onDidChangeContent(async (event) => {
    await refreshDiagnostics(event.document.uri);
});

documents.onDidClose((event) => {
    connection.sendDiagnostics({
        uri: event.document.uri,
        diagnostics: [],
    });
});

documents.listen(connection);
connection.listen();
