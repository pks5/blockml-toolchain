import type { BlockInstanceNode, SourceLocation, TypeExpression } from "@blockml/bom";
import type { MapContext } from "./context.js";
export declare const META_KEYWORD = "org.blockml.bml.meta.Keyword";
export declare const META_ALIAS = "org.blockml.bml.meta.Alias";
declare function namedTypePayloadFqn(expr: TypeExpression | undefined): string | undefined;
declare function isCommaSugarPayload(fqn: string, ctx?: MapContext): boolean;
declare function expandPrimitiveEntityValueSugar(payloadFqn: string, text: string): {
    typeFqn: string;
    value: string;
}[];
declare function primitiveEntitySugarNodes(payloadFqn: string, text: string, ctx: MapContext, source?: SourceLocation): BlockInstanceNode[];
export { expandPrimitiveEntityValueSugar, isCommaSugarPayload, namedTypePayloadFqn, primitiveEntitySugarNodes, };
//# sourceMappingURL=primitive-entity-sugar.d.ts.map