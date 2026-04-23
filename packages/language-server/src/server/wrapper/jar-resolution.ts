import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const WRAPPER_JAR_ENV_VARIABLE = "JSONIQ_RUMBLE_WRAPPER_JAR";

export const WRAPPER_JAR_NAME_PREFIX = "rumble-lsp-wrapper";

export const WRAPPER_JAR_PRODUCTION_FOLDER = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../wrapper"
);

export const WRAPPER_JAR_DEVELOPMENT_FOLDER = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../../rumble-lsp-wrapper/target"
);

export interface WrapperLaunchConfig {
    args: string[];
}

export function resolveWrapperLaunchConfig(): WrapperLaunchConfig {
    // 1. Check for explicitly configured wrapper jar path via environment variable.
    const configuredJarPath = process.env[WRAPPER_JAR_ENV_VARIABLE];
    if (configuredJarPath !== undefined && configuredJarPath.length > 0) {
        return {
            args: ["-jar", configuredJarPath, "--daemon"],
        };
    }

    // 2. In development, the wrapper jar is expected in the target directory.
    if (process.env.JSONIQ_LSP_DEBUG === "1") {
        const jarPath = pickLatestJarFromDirectory(WRAPPER_JAR_DEVELOPMENT_FOLDER);
        return {
            args: ["-jar", jarPath, "--daemon"],
        };
    }

    // 3. In production, the wrapper jar is expected to be copied to ./dist/wrapper.
    const jarPath = pickLatestJarFromDirectory(WRAPPER_JAR_PRODUCTION_FOLDER);

    return {
        args: ["-jar", jarPath, "--daemon"],
    };
}

function pickLatestJarFromDirectory(directory: string): string {
    const files = fs.readdirSync(directory);
    const wrapperJars = files
        .filter((file) => file.startsWith(WRAPPER_JAR_NAME_PREFIX) && file.endsWith(".jar"))
        .map((file) => path.join(directory, file))
        .sort((a, b) => fs.statSync(b).mtime.getTime() - fs.statSync(a).mtime.getTime());

    if (wrapperJars.length === 0) {
        console.warn(`No wrapper jar found in directory '${directory}'.`);
    }

    return wrapperJars[0]!;
}
