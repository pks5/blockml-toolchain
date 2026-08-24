import type { BlockDefinition } from "@blockml/bom";
import type { EmitContext } from "./context.js";
import { XmlWriter } from "./xml.js";
export declare function emitBlockDefinition(writer: XmlWriter, block: BlockDefinition, ctx: EmitContext): void;
export declare function emitRootStartTag(writer: XmlWriter, bindings: Record<string, string>, schemaLocation?: string, noNamespaceSchemaLocation?: string, unknownAttributes?: Record<string, string>): void;
//# sourceMappingURL=block.d.ts.map