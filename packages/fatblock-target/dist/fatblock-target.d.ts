import type { CompileRequest, RenderContext, RenderOutput, RenderTarget } from "@blockml/compiler";
import type { Diagnostic } from "@blockml/bom";
export interface FatBlockRenderOutput extends RenderOutput {
    files: {
        path: string;
        content: string;
    }[];
    diagnostics?: Diagnostic[];
}
export declare class FatBlockTarget implements RenderTarget {
    readonly name = "fatblock";
    readonly accepts: Array<"document">;
    validateRequest(request: CompileRequest): Diagnostic[];
    render(request: CompileRequest, ctx: RenderContext): FatBlockRenderOutput;
}
//# sourceMappingURL=fatblock-target.d.ts.map