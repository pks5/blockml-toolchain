import type { BomDocument } from "@blockml/bom";
export declare class TypeRegistry {
    private readonly byFqn;
    register(document: BomDocument): void;
    private registerBlock;
    get(fqn: string): BomDocument | undefined;
    has(fqn: string): boolean;
    keys(): string[];
    size(): number;
}
//# sourceMappingURL=type-registry.d.ts.map