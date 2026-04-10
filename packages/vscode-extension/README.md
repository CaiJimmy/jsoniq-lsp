# JSONiq VS Code Client

This folder contains a minimal VS Code extension that starts the JSONiq
language server from the parent workspace.

## Expected flow

1. Install workspace dependencies in the repo root with `pnpm install`.
2. Build the server in the repo root with `pnpm run build:server`.
3. Build the client in the repo root with `pnpm run build:client`.
4. Open this `packages/client/` folder in VS Code and press `F5`.
5. In the Extension Development Host, open a `.jq` or `.jsoniq` file.

The extension launches `../server/dist/server/main.js`, so the server package
must be built first.
