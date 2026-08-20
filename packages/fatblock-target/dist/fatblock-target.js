import { assembleFatDocument, serializeFatDocument } from "./assemble-fat-document.js";
import { fatOutputBasename } from "./fat-output-path.js";
import { resolveFatBlockOptions } from "./options.js";
export class FatBlockTarget {
    name = "fatblock";
    accepts = ["document"];
    validateRequest(request) {
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
    render(request, ctx) {
        const options = resolveFatBlockOptions(request.targetOptions);
        const rootDir = options.rootDir ?? process.cwd();
        const hostFilePath = ctx.session.sourceFilePath;
        const { document, diagnostics } = assembleFatDocument(ctx.session.typeRegistry, hostFilePath, options, rootDir);
        if (!document || diagnostics.some((d) => d.severity === "error")) {
            return { files: [], diagnostics };
        }
        const serialized = serializeFatDocument(document);
        if (!serialized.text ||
            serialized.diagnostics.some((d) => d.severity === "error")) {
            return {
                files: [],
                diagnostics: [...diagnostics, ...serialized.diagnostics],
            };
        }
        return {
            files: [
                {
                    path: fatOutputBasename(hostFilePath),
                    content: serialized.text,
                },
            ],
            diagnostics: [...diagnostics, ...serialized.diagnostics].filter((d) => d.severity !== "info"),
        };
    }
}
//# sourceMappingURL=fatblock-target.js.map