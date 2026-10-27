import type { BlockDefinition, Diagnostic, ParseValueHook, ResolveMemberTypeHook } from "@blockml/bom";
import type { Element } from "@xmldom/xmldom";
import { type MapContext } from "./context.js";
export declare function mapBlock(element: Element, ctx: MapContext): BlockDefinition;
export declare function mapDocumentBlock(element: Element, filePath: string, source: string, bindings: Record<string, string>, diagnostics?: Diagnostic[], parseValue?: ParseValueHook, isCommaSugarPayloadHook?: (fqn: string) => boolean, resolveMemberType?: ResolveMemberTypeHook): BlockDefinition;
//# sourceMappingURL=map-block.d.ts.map