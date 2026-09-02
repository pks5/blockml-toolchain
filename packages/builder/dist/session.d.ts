import type { BomDocument, MemberDefinition } from "@blockml/bom";
import type { AddAggregationOptions, AddPropertyOptions, CreateBlockOptions } from "./types.js";
export declare class BomBuilder {
    private readonly document;
    private constructor();
    static create(options: CreateBlockOptions): BomBuilder;
    static edit(document: BomDocument): BomBuilder;
    setName(name: string): this;
    setType(fqn: string): this;
    setBaseType(fqn: string): this;
    setIs(text: string): this;
    setDocumentation(text: string): this;
    setFilePath(filePath: string): this;
    ensureNamespaceBinding(prefix: string, namespace: string): this;
    addProperty(options: AddPropertyOptions): this;
    addAggregation(options: AddAggregationOptions): this;
    addCompositionChild(aggregationName: string, typeFqn: string): this;
    setMemberValue(name: string, value: string): this;
    querySelector(selector: string): MemberDefinition | undefined;
    seal(): BomDocument;
    private bindings;
    private ensurePackageBinding;
    private syncCompositionIndex;
}
//# sourceMappingURL=session.d.ts.map