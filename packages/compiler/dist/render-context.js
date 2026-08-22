class RenderContextImpl {
    session;
    blockFqn;
    outputRelativePath;
    constructor(session, blockFqn, outputRelativePath) {
        this.session = session;
        this.blockFqn = blockFqn;
        this.outputRelativePath = outputRelativePath;
    }
    child(overrides) {
        return new RenderContextImpl(this.session, overrides.blockFqn ?? this.blockFqn, overrides.outputRelativePath ?? this.outputRelativePath);
    }
}
export function createRenderContext(session, blockFqn = "", outputRelativePath = "") {
    return new RenderContextImpl(session, blockFqn, outputRelativePath);
}
export function buildRenderSession(options) {
    const session = {
        typeRegistry: options.typeRegistry,
        sourceFilePath: options.sourceFilePath ?? "<scope>",
        outputBasePath: options.outputBasePath ?? ".",
        targetName: options.targetName,
        scopeKind: options.scopeKind,
    };
    if (options.libraryPaths !== undefined) {
        session.libraryPaths = options.libraryPaths;
    }
    if (options.corpusRoots !== undefined) {
        session.corpusRoots = options.corpusRoots;
    }
    return session;
}
//# sourceMappingURL=render-context.js.map