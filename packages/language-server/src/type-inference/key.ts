import { SourceDefinition } from "server/analysis/model.js";

const INFERENCE_KEY_SEPARATOR = "\u001F";

export type InferenceKey = string;

export function buildInferenceKey(
    kind: string,
    position: { line: number; character: number },
    ...names: string[]
): InferenceKey {
    return [kind, position.line, position.character, ...names].join(INFERENCE_KEY_SEPARATOR);
}

export function buildInferenceKeyForDefinition(definition: SourceDefinition): InferenceKey {
    switch (definition.kind) {
        case "function":
            return buildInferenceKey(
                "function",
                definition.range.start,
                functionNameWithoutArity(definition.name),
            );
        case "parameter":
            return buildInferenceKey(
                "parameter",
                definition.function.range.start,
                functionNameWithoutArity(definition.function.name),
                definition.name,
            );
        default:
            return buildInferenceKey(definition.kind, definition.range.start, definition.name);
    }
}

function functionNameWithoutArity(name: string): string {
    return name.replace(/#\d+$/, "");
}
