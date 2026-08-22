import type { BomDocument, Diagnostic } from "@blockml/bom";
import type { TypeRegistry } from "@blockml/framework";

export type CompileScopeKind = "document" | "library" | "corpus" | "auto";

export interface CompileInput {
  source: string;
  filePath: string;
  format?: "xml";
}

export interface CompileScope {
  kind: CompileScopeKind;
  document?: CompileInput;
  libraries?: string[];
  roots?: string[];
  includeDependencies?: boolean;
}

export interface CompileRequest {
  scope: CompileScope;
  targetOptions?: unknown;
}

export interface CompileOptions {
  typeRegistry?: TypeRegistry;
  outputBasePath?: string;
  rootDir?: string;
}

/** Options for BOM-first Stage-3 (compileBomToOutput). typeRegistry is required. */
export interface CompileBomOptions {
  typeRegistry: TypeRegistry;
  outputBasePath?: string;
  rootDir?: string;
  targetOptions?: unknown;
}

export interface CompilerResult<T> {
  output: T | null;
  diagnostics: Diagnostic[];
  success: boolean;
}

export interface RenderOutputFile {
  path: string;
  content: string;
}

export interface RenderOutput {
  files: RenderOutputFile[];
}

export interface RenderSession {
  typeRegistry: TypeRegistry;
  sourceFilePath: string;
  outputBasePath: string;
  targetName: string;
  /** Resolved scope kind after auto resolution. */
  scopeKind: Exclude<CompileScopeKind, "auto">;
  /** Library.bml paths when scope is library. */
  libraryPaths?: string[];
  /** Corpus roots when scope is corpus. */
  corpusRoots?: string[];
}

export interface RenderContext {
  session: RenderSession;
  blockFqn: string;
  outputRelativePath: string;
  child(overrides: Partial<Omit<RenderContext, "session" | "child">>): RenderContext;
}

export interface RenderTarget {
  name: string;
  accepts: CompileScopeKind[];
  validateRequest?(request: CompileRequest): Diagnostic[];
  render(request: CompileRequest, ctx: RenderContext): RenderOutput;
}

export interface ScopeConfigHints {
  libraries?: string[];
  roots?: string[];
  rootDir?: string;
}

export interface ResolvedScope {
  kind: Exclude<CompileScopeKind, "auto">;
  document?: CompileInput;
  libraries?: string[];
  roots?: string[];
}
