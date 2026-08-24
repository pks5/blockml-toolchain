export function createMapContext(filePath, source, bindings, options = {}) {
    const ctx = {
        filePath,
        source,
        bindings,
        subBlockIndex: options.subBlockIndex ?? new Map(),
        isRoot: options.isRoot ?? false,
        isEmbedded: options.isEmbedded ?? false,
        diagnostics: options.diagnostics ?? [],
    };
    if (options.parentBlockType !== undefined) {
        ctx.parentBlockType = options.parentBlockType;
    }
    return ctx;
}
//# sourceMappingURL=context.js.map