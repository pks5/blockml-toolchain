import type { GraphMember, GraphNeighbor, GraphNode, GraphPath, GraphQueryResult } from "./types.js";
import { graphSchema } from "./schema.js";
import type { GraphStore } from "./store.js";
declare function loadBlock(store: GraphStore, fqn: string): Promise<GraphNode | undefined>;
export declare function uses(store: GraphStore, fqn: string): Promise<GraphNeighbor[]>;
export declare function usedBy(store: GraphStore, fqn: string): Promise<GraphNeighbor[]>;
export declare function neighbors(store: GraphStore, fqn: string): Promise<GraphNeighbor[]>;
export declare function ancestors(store: GraphStore, fqn: string, depth?: number): Promise<GraphNode[]>;
export declare function descendants(store: GraphStore, fqn: string, depth?: number): Promise<GraphNode[]>;
export declare function shortestPath(store: GraphStore, from: string, to: string, depth?: number): Promise<GraphPath | undefined>;
export declare function members(store: GraphStore, fqn: string): Promise<GraphMember[]>;
export declare function runQuery(store: GraphStore, cypher: string, params?: Record<string, unknown>): Promise<GraphQueryResult>;
export { graphSchema, loadBlock };
//# sourceMappingURL=operations.d.ts.map