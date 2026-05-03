import type { TextDocument } from "vscode-languageserver-textdocument";
import { ParseResult } from "./result.js";
import { CompletionIntent } from "./completion.js";

export interface ParserAdapter {
    readonly id: string;

    supports(document: TextDocument): boolean;

    parse(document: TextDocument): ParseResult;

    getCompletionIntent(parsed: ParseResult, cursorOffset: number): CompletionIntent | null;
}
