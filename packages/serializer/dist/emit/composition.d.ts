import type { BlockInstance, CompositionNode, CompositionTemplate, DirectiveAttribute, MemberValue } from "@blockml/bom";
import type { EmitContext } from "./context.js";
import { XmlWriter } from "./xml.js";
export declare function emitCompositionTemplate(writer: XmlWriter, template: CompositionTemplate, ctx: EmitContext, wrapInAggregation?: string): void;
export declare function emitCompositionNode(writer: XmlWriter, node: CompositionNode, ctx: EmitContext): void;
export declare function emitBlockInstance(writer: XmlWriter, instance: BlockInstance, directives: DirectiveAttribute[] | undefined, ctx: EmitContext): void;
export declare function emitConstraintInstances(writer: XmlWriter, instances: BlockInstance[], ctx: EmitContext): void;
export declare function emitTypeReferenceEntity(writer: XmlWriter, value: string, ctx: EmitContext, version?: MemberValue): void;
//# sourceMappingURL=composition.d.ts.map