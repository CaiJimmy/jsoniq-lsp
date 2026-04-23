import { Position } from "vscode-languageserver";

export type WrapperVariableKind =
    | "declare-variable"
    | "let"
    | "for"
    | "for-position"
    | "group-by"
    | "count";

export interface WrapperVariableType {
    name: string;
    type: string;
    kind: WrapperVariableKind;
}

export interface WrapperFunctionType {
    position: Position;
    name: string;
    parameterTypes: Array<{
        name: string;
        type: string;
    }>;
    returnType: string;
}

export interface WrapperTypeError {
    code: string;
    message: string;
    location: string;
    position: Position;
}

export interface WrapperBuiltinFunctionSignature {
    parameterTypes: string[];
    returnType: string;
}

export type WrapperRequestType = "inferTypes" | "builtinFunctions";

export type RequestPayloadByType = {
    inferTypes: {
        requestType: "inferTypes";
        body: string;
    };
    builtinFunctions: {
        requestType: "builtinFunctions";
    };
};

export interface WrapperDaemonRequest {
    id: number;
    requestType: WrapperRequestType;
    body?: string;
}

export interface QueryResponseBody {
    variableTypes: WrapperVariableType[];
    functionTypes: WrapperFunctionType[];
    typeErrors: WrapperTypeError[];
}

export interface BuiltInFunctionListResponseBody {
    builtinFunctions: Record<string, WrapperBuiltinFunctionSignature>;
}

export type ResponseBodyByType = {
    inferTypes: QueryResponseBody;
    builtinFunctions: BuiltInFunctionListResponseBody;
};

export interface WrapperDaemonResponse<ResponseType extends WrapperRequestType = WrapperRequestType> {
    id: number;
    responseType: ResponseType;
    body: ResponseBodyByType[ResponseType];
    error: string | null;
}

export type QueryResponse = WrapperDaemonResponse<"inferTypes">;
export type BuiltInFunctionListResponse = WrapperDaemonResponse<"builtinFunctions">;

export type ResponseByType = {
    inferTypes: QueryResponse;
    builtinFunctions: BuiltInFunctionListResponse;
};
