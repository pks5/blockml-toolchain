export declare const DEFAULT_INSPECT_DEPTH = 1;
export declare const MAX_INSPECT_DEPTH = 3;
export declare const DEFAULT_MAX_BLOCKS = 48;
export declare const DOC_TRUNCATE = 400;
export declare const REF_TRUNCATE = 8;
export declare const TYPE_PACKAGE_PREFIX = "org.blockml.bml.type.";
export declare const VALUE_TYPE_FQN = "org.blockml.bml.core.ValueType";
export type InspectOrigin = "workspace" | "dependency" | "unresolved";
export type InspectTypeKind = "named" | "union" | "generic" | "anonymousStruct" | "self" | "genericParam" | "grouped";
export interface InspectTypeRef {
    kind: InspectTypeKind;
    ref?: string;
    args?: InspectTypeRef[];
    alternatives?: InspectTypeRef[];
    fields?: InspectStructField[];
    name?: string;
    multiplicity?: string;
    expression?: InspectTypeRef;
}
export interface InspectStructField {
    name: string;
    type: InspectTypeRef;
}
export interface InspectedImplementation {
    language: string;
    source: string;
    sourceTruncated?: boolean;
}
export interface InspectedMember {
    kind: "property" | "aggregation" | "association" | "capability";
    name: string;
    type?: InspectTypeRef;
    inputType?: InspectTypeRef;
    outputType?: InspectTypeRef;
    throws?: string[];
    cardinality?: string;
    inheritedFrom?: string;
    visibility?: string;
    readOnly?: boolean;
    abstract?: boolean;
    final?: boolean;
    override?: boolean;
    value?: unknown;
    instances?: InspectedInstance[];
    implementation?: InspectedImplementation;
}
export interface InspectedInstance {
    type: string;
    id?: string;
    generics?: string;
    members?: Record<string, unknown>;
    aggregations?: Record<string, InspectedInstance[]>;
}
export interface InspectedGenericType {
    name: string;
    baseType: InspectTypeRef;
    defaultType?: InspectTypeRef;
}
export interface InspectedReference {
    ref?: string;
    relation: string;
    file?: string;
    url?: string;
}
export interface InspectedBlock {
    fqn: string;
    name: string;
    file?: string;
    origin?: InspectOrigin;
    is?: string;
    documentation?: string;
    documentationTruncated?: boolean;
    baseType?: InspectTypeRef;
    genericTypes?: InspectedGenericType[];
    ancestors?: string[];
    contracts?: string[];
    members: InspectedMember[];
    subBlocks?: string[];
    abstract?: boolean;
    final?: boolean;
    references?: InspectedReference[];
    referencesTruncated?: number;
}
export interface InspectResult {
    root: string;
    depth: number;
    blocks: Record<string, InspectedBlock>;
    unresolved: string[];
    cycles: string[];
    truncated: string[];
}
export interface InspectBlockOptions {
    depth?: number;
    rootDir?: string;
    srcDir?: string;
    maxBlocks?: number;
}
export interface InspectProjectOptions {
    rootDir?: string;
    srcDir?: string;
    libraries?: string[];
    depth?: number;
    maxBlocks?: number;
}
//# sourceMappingURL=types.d.ts.map