/// This script copies the built wrapper jar from the wrapper project to the language server's dist directory
/// It is used for creating the production build of the language server
/// For development, this script is not needed as the wrapper will find the jar in the wrapper's target directory directly
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const languageServerDirectory = path.resolve(scriptDirectory, "..");
const wrapperTargetDirectory = path.resolve(languageServerDirectory, "..", "rumble-lsp-wrapper", "target");
const shadedJarName = fs.readdirSync(wrapperTargetDirectory)
    .sort()
    .find((entry) => /^rumble-lsp-wrapper-.*-all\.jar$/.test(entry));
if (shadedJarName === undefined) {
    throw new Error(`Missing shaded wrapper jar in ${wrapperTargetDirectory}. Run: pnpm run build:wrapper:prod`);
}
const sourceJarPath = path.resolve(wrapperTargetDirectory, shadedJarName);
const wrapperOutputDirectory = path.resolve(languageServerDirectory, "dist", "wrapper");

/// Delete existing wrapper jar if it exists
if (fs.existsSync(wrapperOutputDirectory)) {
    fs.rmSync(wrapperOutputDirectory, { recursive: true, force: true });
}

const outputJarPath = path.resolve(wrapperOutputDirectory, "rumble-lsp-wrapper.jar");
fs.mkdirSync(wrapperOutputDirectory, { recursive: true });
fs.copyFileSync(sourceJarPath, outputJarPath);

console.log(`Synced wrapper jar: ${sourceJarPath} -> ${outputJarPath}`);
