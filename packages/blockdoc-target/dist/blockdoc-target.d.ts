import type { CompileRequest, RenderContext, RenderOutput, RenderTarget } from "@blockml/compiler";
export interface BlockDocRenderOutput extends RenderOutput {
    files: {
        path: string;
        content: string;
    }[];
}
export declare class BlockDocTarget implements RenderTarget {
    readonly name = "blockdoc";
    readonly accepts: Array<"library" | "corpus" | "auto">;
    render(request: CompileRequest, ctx: RenderContext): BlockDocRenderOutput;
}
//# sourceMappingURL=blockdoc-target.d.ts.map