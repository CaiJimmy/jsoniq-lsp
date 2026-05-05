import { InferredType } from "server/wrapper/type-inference.js";

export function formatInferredType(type: InferredType): string {
    if ("returnType" in type) {
        const parameterTypes = type.parameters.map(({ name, sequenceType }) => `${name}: ${sequenceType}`);
        return `(${parameterTypes.join(", ")}) => ${type.returnType}`;
    }

    return type.sequenceType;
}