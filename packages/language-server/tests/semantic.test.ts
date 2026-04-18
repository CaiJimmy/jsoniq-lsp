import { describe, expect, it } from "vitest";

import { collectSemanticDiagnostics } from "../src/server/semantic.js";
import { testDocument } from "./test-utils.js";

describe("JSONiq semantic diagnostics", () => {
    it("reports unresolved variable references", () => {
        const document = testDocument("semantic-unresolved", [
            "declare function local:f($x) {",
            "  $x + $missing",
            "};",
        ]);

        const diagnostics = collectSemanticDiagnostics(document);

        expect(diagnostics.map((diagnostic) => diagnostic.message)).toEqual([
            "Unresolved variable reference '$missing'.",
        ]);
    });

    it("allows duplicate declarations", () => {
        const document = testDocument("semantic-duplicate", [
            "declare variable $x := 1;",
            "declare variable $x := 2;",
            "$x",
        ]);

        const diagnostics = collectSemanticDiagnostics(document);

        expect(diagnostics).toEqual([]);
    });
});
