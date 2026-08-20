import type { CompileRequest, RenderContext, RenderOutput, RenderTarget } from "@blockml/compiler";
export interface XsdRenderOutput extends RenderOutput {
    files: {
        path: string;
        content: string;
    }[];
}
export declare class XsdTarget implements RenderTarget {
    readonly name = "xsd";
    readonly accepts: Array<"library" | "corpus" | "auto">;
    render(request: CompileRequest, ctx: RenderContext): XsdRenderOutput;
}
//# sourceMappingURL=xsd-target.d.ts.map