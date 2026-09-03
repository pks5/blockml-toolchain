import type { DirectiveAttribute, ExpressionValue, GenericsBinding } from "@blockml/bom";
import type { Element } from "@xmldom/xmldom";
import type { SourceLocation } from "@blockml/bom";
import type { MapContext } from "./context.js";
import { type TypeExpressionResolveOptions } from "./type-expression.js";
export declare const isGenericsDirectiveElement: (element: Element) => boolean;
export declare function parseGenericsBinding(element: Element, ctx: MapContext, options?: TypeExpressionResolveOptions): GenericsBinding | undefined;
export declare function parseDirectives(element: Element, loc: SourceLocation, ctx?: MapContext): DirectiveAttribute[];
export declare function parseBmlMeta(element: Element, typeFqn: string, file: string, loc: SourceLocation): {
    id: ExpressionValue | {
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
    version: ExpressionValue | {
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
    bean: ExpressionValue | {
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
    scope: "local" | "context" | undefined;
};
//# sourceMappingURL=directives.d.ts.map