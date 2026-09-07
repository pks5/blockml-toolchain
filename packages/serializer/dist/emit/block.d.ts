import type { BlockDefinition } from "@blockml/bom";
import type { EmitContext } from "./context.js";
import { XmlWriter } from "./xml.js";
export declare function emitBlockDefinition(writer: XmlWriter, block: BlockDefinition, ctx: EmitContext, omitTypeChild?: boolean, omitNameChild?: boolean): void;
export declare function emitRootStartTag(writer: XmlWriter, bindings: Record<string, string>, schemaLocation?: string, noNamespaceSchemaLocation?: string, unknownAttributes?: Record<string, string>, rootTag?: string): void;
//# sourceMappingURL=block.d.ts.map