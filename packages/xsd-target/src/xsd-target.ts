import type { CompileRequest, RenderContext, RenderOutput, RenderTarget } from "@blockml/compiler";
import { emitBlockXsd } from "./emit-block-xsd.js";
import { resolveXsdOptions } from "./options.js";

export interface XsdRenderOutput extends RenderOutput {
  files: { path: string; content: string }[];
}

export class XsdTarget implements RenderTarget {
  readonly name = "xsd";
  readonly accepts: Array<"library" | "corpus" | "auto"> = ["library", "corpus", "auto"];

  render(request: CompileRequest, ctx: RenderContext): XsdRenderOutput {
    resolveXsdOptions(request.targetOptions);
    return {
      files: [
        {
          path: "core/block.xsd",
          content: emitBlockXsd(ctx.session.typeRegistry),
        },
      ],
    };
  }
}
