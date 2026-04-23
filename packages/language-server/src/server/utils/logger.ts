type LogLevel = "debug" | "info" | "warn" | "error";

const DEBUG_LOG_ENV = "JSONIQ_LSP_DEBUG_LOG";
const DEBUG_ENV = "JSONIQ_LSP_DEBUG";

function isDebugEnabled(): boolean {
    return process.env[DEBUG_LOG_ENV] === "1" || process.env[DEBUG_ENV] === "1";
}

function writeLog(level: LogLevel, scope: string, args: unknown[]): void {
    if (level === "debug" && !isDebugEnabled()) {
        return;
    }

    const prefix = `[jsoniq-lsp:${scope}]`;
    const payload = [prefix, ...args];

    switch (level) {
        case "debug":
        case "info":
            console.log(...payload);
            return;
        case "warn":
            console.warn(...payload);
            return;
        case "error":
            console.error(...payload);
            return;
    }
}

export interface Logger {
    debug: (...args: unknown[]) => void;
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
}

export function createLogger(scope: string): Logger {
    return {
        debug: (...args: unknown[]) => writeLog("debug", scope, args),
        info: (...args: unknown[]) => writeLog("info", scope, args),
        warn: (...args: unknown[]) => writeLog("warn", scope, args),
        error: (...args: unknown[]) => writeLog("error", scope, args),
    };
}
