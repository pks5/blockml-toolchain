import type { Diagnostic } from "@blockml/bom";
import { type TypeRegistry } from "@blockml/framework";
import { GraphIndex } from "./graph-index.js";
import type { BuildIndexResult, GraphIndexOptions, IndexStatus } from "./types.js";
export type { BuildIndexResult, GraphDepthOptions, GraphEdge, GraphIndexHandle, GraphIndexOptions, GraphMember, GraphNeighbor, GraphNode, GraphNodeKind, GraphOrigin, GraphPath, GraphPathHop, GraphQueryResult, GraphQueryRow, GraphRelation, GraphSchema, IndexState, IndexStatus, MemberKind, } from "./types.js";
export { DEFAULT_GRAPH_DEPTH, DEFAULT_USES_DEPTH, INDEX_FORMAT_VERSION } from "./types.js";
export { GraphIndex } from "./graph-index.js";
export { graphDataFromRegistry } from "./mapper.js";
export { collectNamedTypes } from "./type-refs.js";
export { defaultIndexDir, resolveIndexDir } from "./fingerprint.js";
export { graphSchema } from "./schema.js";
export declare function buildMemoryIndex(registry: TypeRegistry, options?: {
    rootDir?: string;
    srcDir?: string;
    diagnostics?: Diagnostic[];
}): Promise<GraphIndex>;
export declare function buildIndex(options?: GraphIndexOptions): Promise<BuildIndexResult>;
export declare function getIndexStatus(options?: GraphIndexOptions): Promise<IndexStatus>;
export declare function loadIndex(options?: GraphIndexOptions): Promise<GraphIndex | undefined>;
export declare function rebuildIndex(options?: GraphIndexOptions): Promise<BuildIndexResult>;
export declare function openGraph(options?: GraphIndexOptions): Promise<BuildIndexResult>;
export type { GraphIndexHandle as Graph } from "./types.js";
//# sourceMappingURL=index.d.ts.map