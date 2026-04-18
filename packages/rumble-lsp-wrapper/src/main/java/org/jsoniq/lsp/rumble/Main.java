package org.jsoniq.lsp.rumble;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;

public class Main {
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final TypeInferencer INFERENCER = new TypeInferencer();
    private static final BuiltinFunctions BUILTIN_FUNCTIONS = new BuiltinFunctions();
    private static final String REQUEST_TYPE_INFER_TYPES = "inferTypes";
    private static final String REQUEST_TYPE_BUILTIN_FUNCTIONS = "builtinFunctions";
    private static final QueryResponseBody EMPTY_QUERY_RESPONSE_BODY = new QueryResponseBody(List.of(), List.of());
    private static final BuiltInFunctionListResponseBody EMPTY_BUILTIN_RESPONSE_BODY = new BuiltInFunctionListResponseBody(
            Map.of());
    private static final Map<String, Function<WrapperRequest, WrapperDaemonResponse>> DAEMON_HANDLERS = Map.of(
            REQUEST_TYPE_INFER_TYPES, Main::handleInferTypesRequest,
            REQUEST_TYPE_BUILTIN_FUNCTIONS, Main::handleBuiltinFunctionsRequest);

    private record WrapperResponse(
            List<TypeInferencer.VariableType> variableTypes,
            List<TypeInferencer.FunctionType> functionTypes,
            Map<String, BuiltinFunctions.BuiltinFunctionSignature> builtinFunctions,
            String error) {
    }

    private record WrapperRequest(long id, String requestType, String body) {
    }

    private interface WrapperDaemonResponse {
    }

    private record QueryResponseBody(
            List<TypeInferencer.VariableType> variableTypes,
            List<TypeInferencer.FunctionType> functionTypes) {
    }

    private record BuiltInFunctionListResponseBody(
            Map<String, BuiltinFunctions.BuiltinFunctionSignature> builtinFunctions) {
    }

    private record QueryResponse(
            long id,
            String responseType,
            QueryResponseBody body,
            String error) implements WrapperDaemonResponse {
    }

    private record BuiltInFunctionListResponse(
            long id,
            String responseType,
            BuiltInFunctionListResponseBody body,
            String error) implements WrapperDaemonResponse {
    }

    public static void main(String[] args) {
        if (isDaemonMode(args)) {
            runDaemon();
            return;
        }

        try {
            String query = readAllStdin();
            TypeInferencer.InferenceResult result = INFERENCER.infer(query);
            writeAndExit(new WrapperResponse(result.variableTypes(), result.functionTypes(), Map.of(), result.error()), 0);
        } catch (Throwable throwable) {
            String errorMessage = Objects.toString(throwable.getMessage(), throwable.getClass().getName());
            writeAndExit(new WrapperResponse(List.of(), List.of(), Map.of(), errorMessage), 1);
        }
    }

    private static boolean isDaemonMode(String[] args) {
        for (String argument : args) {
            if ("--daemon".equals(argument)) {
                return true;
            }
        }
        return false;
    }

    private static void runDaemon() {
        try (
                BufferedReader reader = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8));
                PrintWriter writer = new PrintWriter(System.out, true, StandardCharsets.UTF_8)) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) {
                    continue;
                }
                WrapperDaemonResponse response = processDaemonRequest(line);
                writer.println(OBJECT_MAPPER.writeValueAsString(response));
                writer.flush();
            }
            System.exit(0);
        } catch (Throwable throwable) {
            System.exit(1);
        }
    }

    private static WrapperDaemonResponse processDaemonRequest(String requestLine) {
        long requestId = -1L;
        String requestType = REQUEST_TYPE_INFER_TYPES;
        try {
            WrapperRequest request = OBJECT_MAPPER.readValue(requestLine, WrapperRequest.class);
            requestId = request.id();
            requestType = normalizeRequestType(request.requestType());

            Function<WrapperRequest, WrapperDaemonResponse> handler = DAEMON_HANDLERS.get(requestType);
            if (handler == null) {
                return queryErrorResponse(requestId, "Unsupported requestType '" + requestType + "'.");
            }

            return handler.apply(new WrapperRequest(requestId, requestType, request.body()));
        } catch (Throwable throwable) {
            String errorMessage = Objects.toString(throwable.getMessage(), throwable.getClass().getName());
            return errorResponseFor(requestId, requestType, errorMessage);
        }
    }

    private static WrapperDaemonResponse handleInferTypesRequest(WrapperRequest request) {
        if (request.body() == null) {
            return queryErrorResponse(request.id(), "Missing body field.");
        }

        byte[] decodedBytes = Base64.getDecoder().decode(request.body());
        String query = new String(decodedBytes, StandardCharsets.UTF_8);
        TypeInferencer.InferenceResult result = INFERENCER.infer(query);
        return new QueryResponse(
                request.id(),
                REQUEST_TYPE_INFER_TYPES,
                new QueryResponseBody(result.variableTypes(), result.functionTypes()),
                result.error());
    }

    private static WrapperDaemonResponse handleBuiltinFunctionsRequest(WrapperRequest request) {
        Map<String, BuiltinFunctions.BuiltinFunctionSignature> builtinFunctions = BUILTIN_FUNCTIONS.byNameWithArity();
        return new BuiltInFunctionListResponse(
                request.id(),
                REQUEST_TYPE_BUILTIN_FUNCTIONS,
                new BuiltInFunctionListResponseBody(builtinFunctions),
                null);
    }

    private static String normalizeRequestType(String requestType) {
        if (requestType == null || requestType.isBlank()) {
            return REQUEST_TYPE_INFER_TYPES;
        }
        return requestType;
    }

    private static WrapperDaemonResponse queryErrorResponse(long requestId, String errorMessage) {
        return new QueryResponse(requestId, REQUEST_TYPE_INFER_TYPES, EMPTY_QUERY_RESPONSE_BODY, errorMessage);
    }

    private static WrapperDaemonResponse errorResponseFor(long requestId, String requestType, String errorMessage) {
        if (REQUEST_TYPE_BUILTIN_FUNCTIONS.equals(requestType)) {
            return new BuiltInFunctionListResponse(
                    requestId,
                    REQUEST_TYPE_BUILTIN_FUNCTIONS,
                    EMPTY_BUILTIN_RESPONSE_BODY,
                    errorMessage);
        }

        return new QueryResponse(
                requestId,
                REQUEST_TYPE_INFER_TYPES,
                EMPTY_QUERY_RESPONSE_BODY,
                errorMessage);
    }

    private static String readAllStdin() throws IOException {
        StringBuilder content = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8))) {
            String line;
            boolean firstLine = true;
            while ((line = reader.readLine()) != null) {
                if (!firstLine) {
                    content.append('\n');
                }
                content.append(line);
                firstLine = false;
            }
        }
        return content.toString();
    }

    private static void writeAndExit(WrapperResponse response, int exitCode) {
        try {
            System.out.println(OBJECT_MAPPER.writeValueAsString(response));
        } catch (JsonProcessingException exception) {
            System.out
                    .println(
                            "{\"variableTypes\":[],\"functionTypes\":[],\"builtinFunctions\":{},\"error\":\"Failed to serialize wrapper response.\"}");
        }
        System.exit(exitCode);
    }
}
