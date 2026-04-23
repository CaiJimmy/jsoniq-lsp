import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";

import { resolveWrapperLaunchConfig } from "./jar-resolution.js";
import {
    type RequestPayloadByType,
    type ResponseByType,
    type WrapperDaemonRequest,
    type WrapperDaemonResponse,
    type WrapperRequestType,
    type QueryResponse,
    type BuiltInFunctionListResponse,
} from "./protocol.js";

interface PendingRequest {
    expectedResponseType: WrapperRequestType;
    fallbackResponse: WrapperDaemonResponse;
    resolve: (response: WrapperDaemonResponse) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
}

export class RumbleWrapperClient {
    private child: ChildProcessWithoutNullStreams | undefined;
    private nextRequestId = 1;
    private stdoutBuffer = "";
    private readonly pending = new Map<number, PendingRequest>();

    public async inferTypes(query: string): Promise<QueryResponse> {
        const body = Buffer.from(query, "utf8").toString("base64");
        return this.sendRequest<"inferTypes">({
            requestType: "inferTypes",
            body,
        }, {
            id: -1,
            responseType: "inferTypes",
            body: {
                variableTypes: [],
                functionTypes: [],
                typeErrors: [],
            },
            error: "Wrapper request failed.",
        });
    }

    public async listBuiltinFunctions(): Promise<BuiltInFunctionListResponse> {
        return this.sendRequest<"builtinFunctions">({
            requestType: "builtinFunctions",
        }, {
            id: -1,
            responseType: "builtinFunctions",
            body: {
                builtinFunctions: {},
            },
            error: "Wrapper request failed.",
        });
    }

    public ensureProcess(): void {
        if (this.child !== undefined) {
            return;
        }

        const launchConfig = resolveWrapperLaunchConfig();
        console.log(`Launching wrapper with args: ${launchConfig.args.join(" ")}`);

        this.child = spawn("java", launchConfig.args, {
            stdio: "pipe",
        });

        this.child.stdout.setEncoding("utf8");
        this.child.stdout.on("data", (chunk: string) => {
            this.handleStdoutChunk(chunk);
        });

        this.child.on("error", (error) => {
            this.rejectAllPending(error);
            this.child = undefined;
            this.stdoutBuffer = "";
        });

        this.child.on("close", () => {
            this.rejectAllPending(new Error("Wrapper process closed."));
            this.child = undefined;
            this.stdoutBuffer = "";
        });
    }

    public dispose(): void {
        for (const pendingRequest of this.pending.values()) {
            clearTimeout(pendingRequest.timeout);
            pendingRequest.reject(new Error("Wrapper client disposed."));
        }
        this.pending.clear();

        if (this.child !== undefined) {
            this.child.kill();
            this.child = undefined;
        }
    }

    private async sendRequest<RequestType extends WrapperRequestType>(
        requestPayload: RequestPayloadByType[RequestType],
        fallbackResponse: ResponseByType[RequestType],
    ): Promise<ResponseByType[RequestType]> {
        const id = this.nextRequestId;
        this.nextRequestId += 1;

        const request: WrapperDaemonRequest = {
            id,
            ...requestPayload,
        };
        const encodedRequest = JSON.stringify(request);
        const child = this.child;

        if (child === undefined) {
            return {
                ...fallbackResponse,
                id,
                error: "Wrapper process is not available.",
            };
        }

        return new Promise<ResponseByType[RequestType]>((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error("Wrapper timed out."));
            }, 12_000);

            this.pending.set(id, {
                expectedResponseType: requestPayload.requestType,
                fallbackResponse,
                resolve: resolve as unknown as (response: WrapperDaemonResponse) => void,
                reject,
                timeout,
            });

            try {
                child.stdin.write(`${encodedRequest}\n`, "utf8", (error) => {
                    if (error !== undefined && error !== null) {
                        this.rejectPending(id, error);
                    }
                });
            } catch (error) {
                this.rejectPending(id, error instanceof Error ? error : new Error("Wrapper write failed."));
            }
        }).catch((error: unknown) => ({
            ...fallbackResponse,
            id,
            error: error instanceof Error ? error.message : "Wrapper request failed.",
        }) as ResponseByType[RequestType]);
    }

    private handleStdoutChunk(chunk: string): void {
        this.stdoutBuffer += chunk;
        const lines = this.stdoutBuffer.split("\n");
        this.stdoutBuffer = lines.pop() ?? "";

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.length === 0 || !trimmed.startsWith("{")) {
                continue;
            }
            this.handleResponseLine(trimmed);
        }
    }

    private handleResponseLine(line: string): void {
        let response: WrapperDaemonResponse;
        try {
            response = JSON.parse(line) as WrapperDaemonResponse;
        } catch {
            return;
        }

        if (typeof response.id !== "number") {
            return;
        }

        const pendingRequest = this.pending.get(response.id);
        if (pendingRequest === undefined) {
            return;
        }

        clearTimeout(pendingRequest.timeout);
        this.pending.delete(response.id);

        if (response.responseType !== pendingRequest.expectedResponseType) {
            pendingRequest.resolve({
                ...pendingRequest.fallbackResponse,
                id: response.id,
                error: `Wrapper returned responseType '${response.responseType}' for requestType '${pendingRequest.expectedResponseType}'.`,
            });
            return;
        }

        pendingRequest.resolve(response);
    }

    private rejectPending(id: number, error: Error): void {
        const pendingRequest = this.pending.get(id);
        if (pendingRequest === undefined) {
            return;
        }

        clearTimeout(pendingRequest.timeout);
        this.pending.delete(id);
        pendingRequest.reject(error);
    }

    private rejectAllPending(error: Error): void {
        for (const [id, pendingRequest] of this.pending.entries()) {
            clearTimeout(pendingRequest.timeout);
            pendingRequest.reject(error);
            this.pending.delete(id);
        }
    }
}

/// Singleton instance of the wrapper client used across the language server.
export const wrapperClient = new RumbleWrapperClient();
