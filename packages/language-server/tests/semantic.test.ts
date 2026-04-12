import { describe, expect, it } from "vitest";
import { TextDocument } from "vscode-languageserver-textdocument";

import { collectSemanticDiagnostics } from "../src/server/semantic.js";

describe("JSONiq semantic diagnostics", () => {
    it("reports unresolved variable references", () => {
        const document = TextDocument.create(
            "file:///semantic-unresolved.jq",
            "jsoniq",
            1,
            [
                "declare function local:f($x) {",
                "  $x + $missing",
                "};",
            ].join("\n"),
        );

        const diagnostics = collectSemanticDiagnostics(document);

        expect(diagnostics.map((diagnostic) => diagnostic.message)).toEqual([
            "Unresolved variable reference '$missing'.",
        ]);
    });

    it("allows duplicate declarations", () => {
        const document = TextDocument.create(
            "file:///semantic-duplicate.jq",
            "jsoniq",
            1,
            [
                "declare variable $x := 1;",
                "declare variable $x := 2;",
                "$x",
            ].join("\n"),
        );

        const diagnostics = collectSemanticDiagnostics(document);

        expect(diagnostics).toEqual([]);
    });
});
