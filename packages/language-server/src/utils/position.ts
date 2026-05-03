import { Position } from "vscode-languageserver";

export function comparePositions(left: Position, right: Position): number {
    if (left.line !== right.line) {
        return left.line - right.line;
    }

    return left.character - right.character;
}