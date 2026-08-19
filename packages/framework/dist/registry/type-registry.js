export class TypeRegistry {
    byFqn = new Map();
    register(document) {
        this.registerBlock(document, document.block);
    }
    registerBlock(document, block) {
        if (block.type) {
            this.byFqn.set(block.type, { ...document, block });
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