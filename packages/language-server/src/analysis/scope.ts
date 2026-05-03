import type { Position } from "vscode-languageserver";

import type { ScopeKind } from "server/parser/types/semantic-events.js";
import type {
    SourceDefinition,
    SourceFunctionDefinition,
} from "./model.js";

export type AnalysisScopeKind = ScopeKind | "module";

export class Scope {
    private readonly definitionByName = new Map<string, SourceDefinition[]>();

    private constructor(
        public readonly kind: AnalysisScopeKind,
        public readonly parent: Scope | undefined,
        public readonly owner: SourceDefinition | undefined,
    ) { }

    public static module(): Scope {
        return new Scope("module", undefined, undefined);
    }

    public enter(kind: ScopeKind, owner?: SourceDefinition): Scope {
        return new Scope(kind, this, owner);
    }

    public declare(newDefinition: SourceDefinition): void {
        if (!this.definitionByName.has(newDefinition.name)) {
            this.definitionByName.set(newDefinition.name, []);
        }

        const definitionsWithSameName = this.definitionByName.get(newDefinition.name)!;
        const lastDefinition = definitionsWithSameName[definitionsWithSameName.length - 1];
        if (lastDefinition !== undefined) {
            lastDefinition.scopeEnd = newDefinition.range.end;
        }

        definitionsWithSameName.push(newDefinition);
    }

    public resolve(name: string): SourceDefinition | undefined {
        const declarations = this.definitionByName.get(name);
        const declaration = declarations?.[declarations.length - 1];
        if (declaration !== undefined) {
            return declaration;
        }

        return this.parent?.resolve(name);
    }

    public close(scopeEnd: Position): void {
        for (const scopedDefinitions of this.definitionByName.values()) {
            const lastDefinition = scopedDefinitions[scopedDefinitions.length - 1];
            if (lastDefinition !== undefined) {
                lastDefinition.scopeEnd = scopeEnd;
            }
        }
    }

    public get owningFunction(): SourceFunctionDefinition | undefined {
        if (this.owner?.kind === "function") {
            return this.owner;
        }

        return this.parent?.owningFunction;
    }
}
