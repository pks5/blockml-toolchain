import type { Diagnostic } from "@blockml/bom";
export declare const INDEX_FORMAT_VERSION = 1;
export declare const DEFAULT_GRAPH_DEPTH = 16;
export declare const DEFAULT_USES_DEPTH = 1;
export type GraphOrigin = "workspace" | "dependency" | "unresolved";
export type GraphNodeKind = "block" | "member";
export type MemberKind = "property" | "aggregation" | "association" | "capability";
export type GraphRelation = "BASE_TYPE" | "CONTRACT" | "HAS_SUBBLOCK" | "HAS_MEMBER" | "MEMBER_TYPE" | "INPUT_TYPE" | "OUTPUT_TYPE" | "THROWS";
export interface GraphIndexOptions {
    rootDir?: string;
    srcDir?: string;
    libraries?: string[];
    indexDir?: string;
}
export interface GraphDepthOptions {
    depth?: number;
}
export interface GraphNode {
    kind: GraphNodeKind;
    fqn: string;
    name: string;
    file: string;
    origin: GraphOrigin;
    resolved: boolean;
    library?: string;
    memberKind?: MemberKind;
    displayFqn?: string;
}
export interface GraphEdge {
    relation: GraphRelation;
    from: string;
    to: string;
    file?: string;
    line?: number;
    cardinality?: string;
}
export interface GraphNeighbor {
    node: GraphNode;
    relation: GraphRelation;
    direction: "outgoing" | "incoming";
    via?: GraphNode;
    source?: GraphNode;
    file?: string;
    line?: number;
}
export type GraphPathHop = GraphNeighbor;
export interface GraphPath {
    from: GraphNode;
    to: GraphNode;
    hops: GraphPathHop[];
}
export interface GraphMember {
    node: GraphNode;
    relation: "HAS_MEMBER";
    inheritedFrom?: string;
    file?: string;
    line?: number;
}
export interface GraphQueryRow {
    columns: string[];
    values: unknown[];
}
export interface GraphQueryResult {
    columns: string[];
    rows: GraphQueryRow[];
}
export interface GraphSchema {
    nodes: string[];
    relations: GraphRelation[];
    description: string;
    example: string;
}
export type IndexState = "missing" | "ready" | "stale";
export interface IndexStatus {
    state: IndexState;
    blocks?: number;
    members?: number;
    indexDir: string;
}
export interface GraphIndexHandle {
    readonly diagnostics: Diagnostic[];
    readonly blocks: number;
    readonly memberCount: number;
    readonly filePaths: string[];
    uses(fqn: string, options?: GraphDepthOptions): Promise<GraphNeighbor[]>;
    usedBy(fqn: string, options?: GraphDepthOptions): Promise<GraphNeighbor[]>;
    neighbors(fqn: string, options?: GraphDepthOptions): Promise<GraphNeighbor[]>;
    ancestors(fqn: string, options?: GraphDepthOptions): Promise<GraphNode[]>;
    descendants(fqn: string, options?: GraphDepthOptions): Promise<GraphNode[]>;
    path(from: string, to: string, options?: GraphDepthOptions): Promise<GraphPath | undefined>;
    members(fqn: string): Promise<GraphMember[]>;
    block(fqn: string): Promise<GraphNode | undefined>;
    schema(): GraphSchema;
    query(cypher: string, params?: Record<string, unknown>): Promise<GraphQueryResult>;
    close(): Promise<void>;
}
export interface BuildIndexResult {
    index: GraphIndexHandle;
    diagnostics: Diagnostic[];
    blocks: number;
    members: number;
}
//# sourceMappingURL=types.d.ts.map