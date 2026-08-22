import type { RenderContext, RenderSession } from "./types.js";
export declare function createRenderContext(session: RenderSession, blockFqn?: string, outputRelativePath?: string): RenderContext;
export declare function buildRenderSession(options: {
    typeRegistry: RenderSession["typeRegistry"];
    targetName: string;
    outputBasePath?: string;
    sourceFilePath?: string;
    scopeKind: RenderSession["scopeKind"];
    libraryPaths?: string[];
    corpusRoots?: string[];
}): RenderSession;
//# sourceMappingURL=render-context.d.ts.map