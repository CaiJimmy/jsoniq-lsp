import type { ParserAdapter } from "server/parser/types.js";
import { collectCompletionContext } from "./completion-context.js";
import {
    parseJsoniq,
    type JsoniqParsedDocument,
} from "./parse.js";

export type {
    JsoniqParseResult,
    JsoniqParsedDocument,
    JsoniqSyntaxContext,
} from "./parse.js";

export const jsoniqParserAdapter: ParserAdapter<JsoniqParsedDocument> = {
    id: "jsoniq",
    supports: () => true,
    parse: parseJsoniq,
    collectCompletionContext,
};
