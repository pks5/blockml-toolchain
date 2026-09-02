import type { Diagnostic } from "@blockml/bom";
import {
  ancestors as walkAncestors,
  descendants as walkDescendants,
  graphSchema,
  loadBlock,
  members as listMembers,
  neighbors as listNeighbors,
  runQuery,
  shortestPath,
  usedBy as listUsedBy,
  uses as listUses,
} from "./operations.js";
import type { GraphStore } from "./store.js";
import type {
  GraphDepthOptions,
  GraphIndexHandle,
  GraphMember,
  GraphNeighbor,
  GraphNode,
  GraphPath,
  GraphQueryResult,
  GraphSchema,
} from "./types.js";

export class GraphIndex implements GraphIndexHandle {
  readonly diagnostics: Diagnostic[];
  readonly blocks: number;
  readonly memberCount: number;
  readonly filePaths: string[];
  private readonly store: GraphStore;

  constructor(
    store: GraphStore,
    blocks: number,
    memberCount: number,
    filePaths: string[],
    diagnostics: Diagnostic[] = [],
  ) {
    this.store = store;
    this.blocks = blocks;
    this.memberCount = memberCount;
    this.filePaths = filePaths;
    this.diagnostics = diagnostics;
  }

  uses(fqn: string, options?: GraphDepthOptions): Promise<GraphNeighbor[]> {
    return listUses(this.store, fqn, options?.depth);
  }

  usedBy(fqn: string, options?: GraphDepthOptions): Promise<GraphNeighbor[]> {
    return listUsedBy(this.store, fqn, options?.depth);
  }

  neighbors(fqn: string, options?: GraphDepthOptions): Promise<GraphNeighbor[]> {
    return listNeighbors(this.store, fqn, options?.depth);
  }

  ancestors(fqn: string, options?: GraphDepthOptions): Promise<GraphNode[]> {
    return walkAncestors(this.store, fqn, options?.depth);
  }

  descendants(fqn: string, options?: GraphDepthOptions): Promise<GraphNode[]> {
    return walkDescendants(this.store, fqn, options?.depth);
  }

  path(from: string, to: string, options?: GraphDepthOptions): Promise<GraphPath | undefined> {
    return shortestPath(this.store, from, to, options?.depth);
  }

  members(fqn: string): Promise<GraphMember[]> {
    return listMembers(this.store, fqn);
  }

  block(fqn: string): Promise<GraphNode | undefined> {
    return loadBlock(this.store, fqn);
  }

  schema(): GraphSchema {
    return graphSchema();
  }

  query(cypher: string, params?: Record<string, unknown>): Promise<GraphQueryResult> {
    return runQuery(this.store, cypher, params);
  }

  close(): Promise<void> {
    return this.store.close();
  }
}
