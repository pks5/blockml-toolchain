import type { SourceInfo } from "@blockml/bom";
import type { Element } from "@xmldom/xmldom";
import { BML_XMLNS, XSI_NS } from "../util/qname.js";
export declare function extractNamespaceBindings(element: Element): SourceInfo;
export declare function mergeSourceInfo(partial: SourceInfo, filePath: string): SourceInfo;
export { XSI_NS, BML_XMLNS };
//# sourceMappingURL=namespaces.d.ts.map