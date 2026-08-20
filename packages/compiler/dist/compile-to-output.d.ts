import type { CompileInput, CompileOptions, CompileRequest, CompilerResult, RenderOutput, ScopeConfigHints } from "./types.js";
export declare function compileBomToOutput(_model: unknown, targetName: string, options?: CompileOptions): CompilerResult<RenderOutput>;
export declare function compileBmlToOutput(input: CompileInput, targetName: string, options?: CompileOptions): CompilerResult<RenderOutput>;
export declare function compileToOutput(request: CompileRequest, targetName: string, options?: CompileOptions, configHints?: ScopeConfigHints): CompilerResult<RenderOutput>;
//# sourceMappingURL=compile-to-output.d.ts.map