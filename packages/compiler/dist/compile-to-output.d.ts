import type { BomDocument } from "@blockml/bom";
import type { CompileBomOptions, CompileInput, CompileOptions, CompileRequest, CompilerResult, RenderOutput, ScopeConfigHints } from "./types.js";
export declare function compileBomToOutput(document: BomDocument, targetName: string, options: CompileBomOptions): CompilerResult<RenderOutput>;
export declare function compileBmlToOutput(input: CompileInput, targetName: string, options?: CompileOptions): CompilerResult<RenderOutput>;
export declare function compileToOutput(request: CompileRequest, targetName: string, options?: CompileOptions, configHints?: ScopeConfigHints): CompilerResult<RenderOutput>;
//# sourceMappingURL=compile-to-output.d.ts.map