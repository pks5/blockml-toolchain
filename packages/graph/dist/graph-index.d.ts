import type { Diagnostic } from "@blockml/bom";
import type { GraphStore } from "./store.js";
import type { GraphDepthOptions, GraphIndexHandle, GraphMember, GraphNeighbor, GraphNode, GraphPath, GraphQueryResult, GraphSchema } from "./types.js";
export declare class GraphIndex implements GraphIndexHandle {
    readonly diagnostics: Diagnostic[];
    readonly blocks: number;
    readonly memberCount: number;
    readonly filePaths: string[];
    private readonly store;
    constructor(store: GraphStore, blocks: number, memberCount: number, filePaths: string[], diagnostics?: Diagnostic[]);
    uses(fqn: string): Promise<GraphNeighbor[]>;
    usedBy(fqn: string): Promise<GraphNeighbor[]>;
    neighbors(fqn: string): Promise<GraphNeighbor[]>;
    ancestors(fqn: string, options?: GraphDepthOptions): Promise<GraphNode[]>;
    descendants(fqn: string, options?: GraphDepthOptions): Promise<GraphNode[]>;
    path(from: string, to: string, options?: GraphDepthOptions): Promise<GraphPath | undefined>;
    members(fqn: string): Promise<GraphMember[]>;
    block(fqn: string): Promise<GraphNode | undefined>;
    schema(): GraphSchema;
    query(cypher: string, params?: Record<string, unknown>): Promise<GraphQueryResult>;
    close(): Promise<void>;
}
//# sourceMappingURL=graph-index.d.ts.map