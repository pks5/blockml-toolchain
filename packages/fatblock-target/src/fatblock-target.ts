import type { CompileRequest, RenderContext, RenderOutput, RenderTarget } from "@blockml/compiler";
import type { Diagnostic } from "@blockml/bom";
import { assembleFatDocument, serializeFatDocument } from "./assemble-fat-document.js";
import { fatOutputBasename } from "./fat-output-path.js";
import { resolveFatBlockOptions } from "./options.js";

export interface FatBlockRenderOutput extends RenderOutput {
  files: { path: string; content: string }[];
  diagnostics?: Diagnostic[];
}

export class FatBlockTarget implements RenderTarget {
  readonly name = "fatblock";
  readonly accepts: Array<"document"> = ["document"];

  validateRequest(request: CompileRequest): Diagnostic[] {
    const options = resolveFatBlockOptions(request.targetOptions);
    if (!options.srcDir) {
      return [
        {
          severity: "error",
          code: "BML_FATBLOCK_SRC_REQUIRED",
          message: "FatBlock requires targetOptions.srcDir (CLI: --src)",
          source: { file: "<config>", line: 1, column: 1 },
        },
      ];
    }
    return [];
  }

  render(request: CompileRequest, ctx: RenderContext): FatBlockRenderOutput {
    const options = resolveFatBlockOptions(request.targetOptions);
    const rootDir = options.rootDir ?? process.cwd();
    const hostFilePath = ctx.session.sourceFilePath;

    const { document, diagnostics } = assembleFatDocument(
      ctx.session.typeRegistry,
      hostFilePath,
      options,
      rootDir,
    );

    if (!document || diagnostics.some((d) => d.severity === "error")) {
      return { files: [], diagnostics };
    }

    const serialized = serializeFatDocument(document);
    if (
      !serialized.text ||
      serialized.diagnostics.some((d) => d.severity === "error")
    ) {
      return {
        files: [],
        diagnostics: [...diagnostics, ...serialized.diagnostics],
      };
    }

    return {
      files: [
        {
          path: fatOutputBasename(document.block.type),
          content: serialized.text,
        },
      ],
      diagnostics: [...diagnostics, ...serialized.diagnostics].filter(
        (d) => d.severity !== "info",
      ),
    };
  }
}
