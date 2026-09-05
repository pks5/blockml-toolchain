import { isNodeModulesPath } from "./package-paths.js";
function documentSourcePath(document) {
    return document.source?.filePath || document.block.source?.file || "";
}
/** Keep a workspace entry when the incoming file is an npm copy of the same FQN. */
function keepExisting(existing, incoming) {
    return (isNodeModulesPath(documentSourcePath(incoming)) &&
        !isNodeModulesPath(documentSourcePath(existing)));
}
export class TypeRegistry {
    byFqn = new Map();
    register(document) {
        this.registerBlock(document, document.block);
    }
    /**
     * Copy with `document` registered (open-buffer overlay). Does not mutate this.
     * Workspace-vs-npm priority still applies on the copy.
     */
    withOverlay(document) {
        const next = new TypeRegistry();
        for (const [fqn, doc] of this.byFqn) {
            next.byFqn.set(fqn, doc);
        }
        next.register(document);
        return next;
    }
    registerBlock(document, block) {
        if (block.type) {
            const existing = this.byFqn.get(block.type);
            if (!existing || !keepExisting(existing, { ...document, block })) {
                this.byFqn.set(block.type, { ...document, block });
            }
        }
        for (const sub of block.subBlocks) {
            this.registerBlock(document, sub);
        }
    }
    get(fqn) {
        return this.byFqn.get(fqn);
    }
    has(fqn) {
        return this.byFqn.has(fqn);
    }
    keys() {
        return [...this.byFqn.keys()];
    }
    size() {
        return this.byFqn.size;
    }
}
//# sourceMappingURL=type-registry.js.map