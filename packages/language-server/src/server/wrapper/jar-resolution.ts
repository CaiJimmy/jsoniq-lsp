import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createLogger } from "../utils/logger.js";

export const WRAPPER_JAR_PRODUCTION_FOLDER = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../wrapper"
);

export const WRAPPER_JAR_NAME_PREFIX = "rumble-lsp-wrapper";
export const WRAPPER_JAR_DEVELOPMENT_FOLDER = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../../rumble-lsp-wrapper/target"
);
export const WRAPPER_RUNTIME_CLASSPATH_FILE = "runtime-classpath.txt";
export const WRAPPER_MAIN_CLASS = "org.jsoniq.lsp.rumble.Main";
export const WRAPPER_RELEASE_MANIFEST_FILE = "release-manifest.json";
export const WRAPPER_REMOTE_JAR_FILE = "rumble-lsp-wrapper.remote.jar";

const logger = createLogger("wrapper:jar-resolution");

export interface WrapperLaunchConfig {
    args: string[];
}

interface WrapperReleaseManifest {
    jarUrl: string;
    jarSha256: string;
}

export async function resolveWrapperLaunchConfig(): Promise<WrapperLaunchConfig> {
    const developmentConfig = resolveDevelopmentLaunchConfig();
    if (developmentConfig !== undefined) {
        return developmentConfig;
    }

    const manifest = readReleaseManifest();
    const cachedJarPath = path.join(WRAPPER_JAR_PRODUCTION_FOLDER, WRAPPER_REMOTE_JAR_FILE);

    if (fs.existsSync(cachedJarPath) && computeFileSha256(cachedJarPath) === manifest.jarSha256) {
        return {
            args: ["-jar", cachedJarPath, "--daemon"],
        };
    }

    logger.info(`Downloading wrapper jar from '${manifest.jarUrl}'.`);
    const response = await fetch(manifest.jarUrl);
    if (!response.ok) {
        throw new Error(`Failed to download wrapper jar: HTTP ${response.status} ${response.statusText}`);
    }

    const jarBuffer = Buffer.from(await response.arrayBuffer());
    if (manifest.jarSha256 !== undefined && manifest.jarSha256.length > 0) {
        const downloadedSha = createHash("sha256").update(jarBuffer).digest("hex");
        if (downloadedSha !== manifest.jarSha256) {
            throw new Error(
                `Downloaded wrapper jar hash mismatch: expected '${manifest.jarSha256}', got '${downloadedSha}'.`
            );
        }
    }

    fs.mkdirSync(WRAPPER_JAR_PRODUCTION_FOLDER, { recursive: true });
    fs.writeFileSync(cachedJarPath, jarBuffer);

    return {
        args: ["-jar", cachedJarPath, "--daemon"],
    };
}

function resolveDevelopmentLaunchConfig(): WrapperLaunchConfig | undefined {
    const localJarPath = pickLatestJarFromDirectory(WRAPPER_JAR_DEVELOPMENT_FOLDER);
    const classpathPath = path.join(WRAPPER_JAR_DEVELOPMENT_FOLDER, WRAPPER_RUNTIME_CLASSPATH_FILE);
    if (localJarPath === undefined || !fs.existsSync(classpathPath)) {
        return undefined;
    }

    const runtimeClasspath = fs.readFileSync(classpathPath, "utf8").trim();
    const classpath = runtimeClasspath.length === 0
        ? localJarPath
        : `${localJarPath}${path.delimiter}${runtimeClasspath}`;

    return {
        args: ["-cp", classpath, WRAPPER_MAIN_CLASS, "--daemon"],
    };
}

function readReleaseManifest(): WrapperReleaseManifest {
    const manifestPath = path.join(WRAPPER_JAR_PRODUCTION_FOLDER, WRAPPER_RELEASE_MANIFEST_FILE);
    if (!fs.existsSync(manifestPath)) {
        throw new Error(`Wrapper release manifest not found: '${manifestPath}'.`);
    }
    const manifestRaw = fs.readFileSync(manifestPath, "utf8");
    return JSON.parse(manifestRaw) as WrapperReleaseManifest;
}

function computeFileSha256(filePath: string): string {
    const fileContent = fs.readFileSync(filePath);
    return createHash("sha256").update(fileContent).digest("hex");
}

function pickLatestJarFromDirectory(
    directory: string,
): string | undefined {
    if (!fs.existsSync(directory)) {
        return undefined;
    }

    const files = fs.readdirSync(directory);
    const wrapperJars = files
        .filter((file) => file.startsWith(WRAPPER_JAR_NAME_PREFIX) && file.endsWith(".jar"))
        .map((file) => path.join(directory, file))
        .sort((a, b) => fs.statSync(b).mtime.getTime() - fs.statSync(a).mtime.getTime());

    return wrapperJars[0];
}
