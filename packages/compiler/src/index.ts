export type {
  CompileScopeKind,
  CompileInput,
  CompileScope,
  CompileRequest,
  CompileOptions,
  CompileBomOptions,
  CompilerResult,
  ValidateRegistryResult,
  RenderOutput,
  RenderOutputFile,
  RenderSession,
  RenderContext,
  RenderTarget,
  ScopeConfigHints,
  ResolvedScope,
} from "./types.js";

export { registerTarget, getTarget, clearTargets, registeredTargetNames } from "./target-registry.js";
export { resolveScope, scopeAccepts } from "./scope.js";
export { compileBmlToBom, validateRegistryDocuments } from "./compile-bml-to-bom.js";
export {
  compileToOutput,
  compileBomToOutput,
  compileBmlToOutput,
} from "./compile-to-output.js";
export { createRenderContext, buildRenderSession } from "./render-context.js";
