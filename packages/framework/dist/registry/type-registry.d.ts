import type { BomDocument } from "@blockml/bom";
export declare class TypeRegistry {
    private readonly byFqn;
    register(document: BomDocument): void;
    /**
     * Copy with `document` registered (open-buffer overlay). Does not mutate this.
     * Workspace-vs-npm priority still applies on the copy.
     */
    withOverlay(document: BomDocument): TypeRegistry;
    private registerBlock;
    get(fqn: string): BomDocument | undefined;
    has(fqn: string): boolean;
    keys(): string[];
    size(): number;
}
//# sourceMappingURL=type-registry.d.ts.map