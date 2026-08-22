import type { RenderContext, RenderSession } from "./types.js";

class RenderContextImpl implements RenderContext {
  readonly session: RenderSession;
  readonly blockFqn: string;
  readonly outputRelativePath: string;

  constructor(session: RenderSession, blockFqn: string, outputRelativePath: string) {
    this.session = session;
    this.blockFqn = blockFqn;
    this.outputRelativePath = outputRelativePath;
  }

  child(overrides: Partial<Omit<RenderContext, "session" | "child">>): RenderContext {
    return new RenderContextImpl(
      this.session,
      overrides.blockFqn ?? this.blockFqn,
      overrides.outputRelativePath ?? this.outputRelativePath,
    );
  }
}

export function createRenderContext(
  session: RenderSession,
  blockFqn = "",
  outputRelativePath = "",
): RenderContext {
  return new RenderContextImpl(session, blockFqn, outputRelativePath);
}

export function buildRenderSession(
  options: {
    typeRegistry: RenderSession["typeRegistry"];
    targetName: string;
    outputBasePath?: string;
    sourceFilePath?: string;
    scopeKind: RenderSession["scopeKind"];
    libraryPaths?: string[];
    corpusRoots?: string[];
  },
): RenderSession {
  const session: RenderSession = {
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
