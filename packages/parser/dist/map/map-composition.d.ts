import type { BlockInstanceNode, CompositionTemplate, SourceLocation } from "@blockml/bom";
import type { Element } from "@xmldom/xmldom";
import { type ImplicitNamespaceContext } from "../util/qname.js";
import type { MapContext } from "./context.js";
export declare function mapCompositionTemplate(element: Element, aggregationName: string, ctx: MapContext): CompositionTemplate;
export declare function mapBlockInstanceNode(element: Element, ctx: MapContext): BlockInstanceNode;
export declare function isTypeReferenceEntitySugar(element: Element, ctx: MapContext): boolean;
export declare function mapTypeReferenceEntityInstance(element: Element, ctx: MapContext, boundB?: string, implicit?: ImplicitNamespaceContext): {
    inst: {
        boundB?: string;
        typeFqn: "org.blockml.bml.type.TypeReferenceEntity";
        value: string;
    };
    version: import("@blockml/bom").ExpressionValue | {
        kind: "interpolated";
        raw: string;
        source: SourceLocation;
        value?: never;
        typeFqn?: never;
    } | {
        kind: "literal";
        value: string;
        typeFqn: string;
        raw?: never;
        source?: never;
    } | undefined;
};
export declare function buildSubBlockIndex(subBlocks: {
    name: string;
    type: string;
}[], parentType: string): Map<string, string>;
//# sourceMappingURL=map-composition.d.ts.map