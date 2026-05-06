import { Token } from "antlr4ng";
import { lowerBound } from "server/utils/binary-search.js";

export function findCaretToken(
    tokens: Token[],
    cursorOffset: number,
): { tokenIndex: number; offset: number } {
    if (tokens.length === 0) {
        return { tokenIndex: 0, offset: cursorOffset };
    }

    const insertionPoint = lowerBound(
        tokens,
        cursorOffset,
        (token, target) => token.start - target,
    );
    let tokenIndex = tokens[tokens.length - 1]!.tokenIndex;

    if (insertionPoint > 0) {
        const token = tokens[insertionPoint - 1]!;
        if (token.type !== Token.EOF && token.start <= cursorOffset && cursorOffset <= token.stop) {
            tokenIndex = token.tokenIndex;
        } else if (insertionPoint < tokens.length) {
            tokenIndex = tokens[insertionPoint]!.tokenIndex;
        }
    } else if (insertionPoint < tokens.length) {
        tokenIndex = tokens[insertionPoint]!.tokenIndex;
    }

    for (let index = tokenIndex; index >= 0; index -= 1) {
        const token = tokens[index]!;
        if (
            token.type !== Token.EOF &&
            (token.channel ?? Token.DEFAULT_CHANNEL) === Token.DEFAULT_CHANNEL
        ) {
            return {
                tokenIndex,
                offset: Math.min(cursorOffset, token.stop + 1),
            };
        }
    }

    return { tokenIndex, offset: cursorOffset };
}
