import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface WrapperVariableType {
    line: number;
    column: number;
    name: string;
    type: string;
    nodeKind: string;
}

export interface WrapperFunctionType {
    line: number;
    column: number;
    name: string;
    parameterTypes: Record<string, string>;
    returnType: string;
}

interface WrapperDaemonRequest {
    id: number;
    queryBase64: string;
}

export interface WrapperDaemonResponse {
    id: number;
    variableTypes: WrapperVariableType[];
    functionTypes: WrapperFunctionType[];
    error: string | null;
}

interface PendingRequest {
    resolve: (response: WrapperDaemonResponse) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
}

interface WrapperLaunchConfig {
    args: string[];
}

export class RumbleWrapperConnection {
    private child: ChildProcessWithoutNullStreams | undefined;
    private nextRequestId = 1;
    private stdoutBuffer = "";
    private readonly pending = new Map<number, PendingRequest>();

    public async inferTypes(query: string): Promise<WrapperDaemonResponse> {
        this.ensureProcess();
        const id = this.nextRequestId;
        this.nextRequestId += 1;

        const queryBase64 = Buffer.from(query, "utf8").toString("base64");
        const request: WrapperDaemonRequest = { id, queryBase64 };
        const encodedRequest = JSON.stringify(request);
        const child = this.child;

        if (child === undefined) {
            return {
                id,
                variableTypes: [],
                functionTypes: [],
                error: "Wrapper process is not available.",
            };
        }

        return new Promise<WrapperDaemonResponse>((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error("Wrapper timed out."));
            }, 12_000);

            this.pending.set(id, { resolve, reject, timeout });

            child.stdin.write(`${encodedRequest}\n`, "utf8", (error) => {
                if (error !== undefined && error !== null) {
                    this.rejectPending(id, error);
                }
            });
        }).catch((error: unknown) => ({
            id,
            variableTypes: [],
            functionTypes: [],
            error: error instanceof Error ? error.message : "Wrapper request failed.",
        }));
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

    private ensureProcess(): void {
        if (this.child !== undefined) {
            return;
        }

        const launchConfig = resolveWrapperLaunchConfig();
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

        if (
            typeof response.id !== "number"
            || !Array.isArray(response.variableTypes)
            || !Array.isArray(response.functionTypes)
        ) {
            return;
        }

        const pendingRequest = this.pending.get(response.id);
        if (pendingRequest === undefined) {
            return;
        }

        clearTimeout(pendingRequest.timeout);
        this.pending.delete(response.id);
        pendingRequest.resolve({
            id: response.id,
            variableTypes: response.variableTypes,
            functionTypes: response.functionTypes,
            error: response.error ?? null,
        });
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

function resolveWrapperLaunchConfig(): WrapperLaunchConfig {
    const configuredJarPath = process.env.JSONIQ_RUMBLE_WRAPPER_JAR;
    if (configuredJarPath !== undefined && configuredJarPath.length > 0) {
        return {
            args: ["-jar", configuredJarPath, "--daemon"],
        };
    }

    const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
    const wrapperTargetDirectory = path.resolve(
        moduleDirectory,
        "../../../rumble-lsp-wrapper/target",
    );

    const wrapperJarPath = path.resolve(wrapperTargetDirectory, "rumble-lsp-wrapper-0.1.0.jar");
    const runtimeClasspathPath = path.resolve(wrapperTargetDirectory, "runtime-classpath.txt");

    if (!fs.existsSync(runtimeClasspathPath)) {
        return {
            args: ["-jar", wrapperJarPath, "--daemon"],
        };
    }

    const runtimeClasspath = fs.readFileSync(runtimeClasspathPath, "utf8").trim();
    const completeClasspath = runtimeClasspath.length > 0
        ? `${wrapperJarPath}${path.delimiter}${runtimeClasspath}`
        : wrapperJarPath;

    return {
        args: [
            "-cp",
            completeClasspath,
            "org.jsoniq.lsp.rumble.RumbleTypeInferencerMain",
            "--daemon",
        ],
    };
}
