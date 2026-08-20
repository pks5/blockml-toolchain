import { BML_DOCUMENT_NS, BML_SERVICE_NS, BML_TYPES_NS, } from "./constants.js";
import { catalogRelativePath, emitCatalogXml } from "./emit-catalog-xml.js";
import { emitBlockXsd } from "./emit-block-xsd.js";
import { emitServiceXsd } from "./emit-service-xsd.js";
import { emitTypesXsd } from "./emit-types-xsd.js";
import { resolveXsdOptions } from "./options.js";
export class XsdTarget {
    name = "xsd";
    accepts = ["library", "corpus", "auto"];
    render(request, ctx) {
        const options = resolveXsdOptions(request.targetOptions);
        const registry = ctx.session.typeRegistry;
        const outDir = ctx.session.outputBasePath;
        const files = [
            {
                path: "bml.xsd",
                content: emitBlockXsd(registry),
            },
        ];
        const catalogEntries = [
            {
                namespaceUri: BML_DOCUMENT_NS,
                relativePath: catalogRelativePath(outDir, "bml.xsd"),
            },
        ];
        if (options.emitDomainSchemas) {
            files.push({
                path: "types.xsd",
                content: emitTypesXsd(registry),
            }, {
                path: "service.xsd",
                content: emitServiceXsd(registry),
            });
            catalogEntries.push({
                namespaceUri: BML_TYPES_NS,
                relativePath: catalogRelativePath(outDir, "types.xsd"),
            }, {
                namespaceUri: BML_SERVICE_NS,
                relativePath: catalogRelativePath(outDir, "service.xsd"),
            });
        }
        return {
            files,
            rootFiles: [
                {
                    path: "catalog.xml",
                    content: emitCatalogXml(catalogEntries),
                },
            ],
        };
    }
}
//# sourceMappingURL=xsd-target.js.map