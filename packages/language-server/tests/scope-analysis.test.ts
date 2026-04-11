import { describe, expect, it } from "vitest";
import { TextDocument } from "vscode-languageserver-textdocument";

import { analyzeVariableScopes } from "../src/server/analysis.js";

describe("JSONiq variable scope analysis", () => {
    it("collects variable declarations from function params and FLWOR clauses", () => {
        const document = TextDocument.create(
            "file:///scope-declarations.jq",
            "jsoniq",
            1,
            [
                "declare function local:f($a, $b as integer) {",
                "  for $x at $pos in (1, 2, 3)",
                "  let $y := $x + $a",
                "  group by $g := $y mod 2",
                "  count $c",
                "  return $g + $c + $b",
                "};",
            ].join("\n"),
        );

        const analysis = analyzeVariableScopes(document);
        const declarationNames = analysis.declarations.map((declaration) => declaration.name);

        expect(declarationNames).toEqual([
            "$a",
            "$b",
            "$x",
            "$pos",
            "$y",
            "$g",
            "$c",
        ]);
    });

    it("resolves references to the nearest declaration", () => {
        const document = TextDocument.create(
            "file:///scope-resolution.jq",
            "jsoniq",
            1,
            [
                "declare variable $x := 10;",
                "declare function local:f($x) {",
                "  let $y := $x + 1",
                "  return $y + $x",
                "};",
                "local:f($x)",
            ].join("\n"),
        );

        const analysis = analyzeVariableScopes(document);
        const references = analysis.references.map((reference) => ({
            name: reference.name,
            line: reference.range.start.line,
            resolvedTo: reference.declaration?.name,
            resolvedKind: reference.declaration?.kind,
        }));

        expect(references).toEqual([
            { name: "$x", line: 2, resolvedTo: "$x", resolvedKind: "parameter" },
            { name: "$y", line: 3, resolvedTo: "$y", resolvedKind: "let" },
            { name: "$x", line: 3, resolvedTo: "$x", resolvedKind: "parameter" },
            { name: "$x", line: 5, resolvedTo: "$x", resolvedKind: "declare-variable" },
        ]);
    });

    it("supports multiple for variables in the same clause", () => {
        const document = TextDocument.create(
            "file:///scope-multi-for.jq",
            "jsoniq",
            1,
            [
                "for $x in (1, 2, 3), $y in ($x, 4)",
                "return 10 * $x + $y",
            ].join("\n"),
        );

        const analysis = analyzeVariableScopes(document);

        expect(analysis.declarations.map((declaration) => declaration.name)).toEqual([
            "$x",
            "$y",
        ]);
        expect(analysis.references.map((reference) => ({
            name: reference.name,
            line: reference.range.start.line,
            resolvedTo: reference.declaration?.name,
        }))).toEqual([
            { name: "$x", line: 0, resolvedTo: "$x" },
            { name: "$x", line: 1, resolvedTo: "$x" },
            { name: "$y", line: 1, resolvedTo: "$y" },
        ]);
    });

    it("supports multiple for bindings that each define an at-position variable", () => {
        const document = TextDocument.create(
            "file:///scope-multi-for-at.jq",
            "jsoniq",
            1,
            [
                "for $x at $ix in (1, 2), $y at $iy in ($x, 3)",
                "return $x + $ix + $y + $iy",
            ].join("\n"),
        );

        const analysis = analyzeVariableScopes(document);

        expect(analysis.declarations.map((declaration) => ({
            name: declaration.name,
            kind: declaration.kind,
        }))).toEqual([
            { name: "$x", kind: "for" },
            { name: "$ix", kind: "for-position" },
            { name: "$y", kind: "for" },
            { name: "$iy", kind: "for-position" },
        ]);

        expect(analysis.references.map((reference) => ({
            name: reference.name,
            line: reference.range.start.line,
            resolvedTo: reference.declaration?.name,
            resolvedKind: reference.declaration?.kind,
        }))).toEqual([
            { name: "$x", line: 0, resolvedTo: "$x", resolvedKind: "for" },
            { name: "$x", line: 1, resolvedTo: "$x", resolvedKind: "for" },
            { name: "$ix", line: 1, resolvedTo: "$ix", resolvedKind: "for-position" },
            { name: "$y", line: 1, resolvedTo: "$y", resolvedKind: "for" },
            { name: "$iy", line: 1, resolvedTo: "$iy", resolvedKind: "for-position" },
        ]);
    });
});
