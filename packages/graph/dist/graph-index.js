import { ancestors as walkAncestors, descendants as walkDescendants, graphSchema, loadBlock, members as listMembers, neighbors as listNeighbors, runQuery, shortestPath, usedBy as listUsedBy, uses as listUses, } from "./operations.js";
export class GraphIndex {
    diagnostics;
    blocks;
    memberCount;
    filePaths;
    store;
    constructor(store, blocks, memberCount, filePaths, diagnostics = []) {
        this.store = store;
        this.blocks = blocks;
        this.memberCount = memberCount;
        this.filePaths = filePaths;
        this.diagnostics = diagnostics;
    }
    uses(fqn) {
        return listUses(this.store, fqn);
    }
    usedBy(fqn) {
        return listUsedBy(this.store, fqn);
    }
    neighbors(fqn) {
        return listNeighbors(this.store, fqn);
    }
    ancestors(fqn, options) {
        return walkAncestors(this.store, fqn, options?.depth);
    }
    descendants(fqn, options) {
        return walkDescendants(this.store, fqn, options?.depth);
    }
    path(from, to, options) {
        return shortestPath(this.store, from, to, options?.depth);
    }
    members(fqn) {
        return listMembers(this.store, fqn);
    }
    block(fqn) {
        return loadBlock(this.store, fqn);
    }
    schema() {
        return graphSchema();
    }
    query(cypher, params) {
        return runQuery(this.store, cypher, params);
    }
    close() {
        return this.store.close();
    }
}
//# sourceMappingURL=graph-index.js.map