import type { BlockDefinition, Diagnostic } from "@blockml/bom";
import type { Element } from "@xmldom/xmldom";
import { type MapContext } from "./context.js";
export declare function mapBlock(element: Element, ctx: MapContext): BlockDefinition;
export declare function mapDocumentBlock(element: Element, filePath: string, source: string, bindings: Record<string, string>, diagnostics?: Diagnostic[]): BlockDefinition;
//# sourceMappingURL=map-block.d.ts.map