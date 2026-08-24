import type { DirectiveAttribute, ExpressionValue } from "@blockml/bom";
import type { Element } from "@xmldom/xmldom";
import type { SourceLocation } from "@blockml/bom";
import type { MapContext } from "./context.js";
export declare function parseDirectives(element: Element, loc: SourceLocation, ctx?: MapContext): DirectiveAttribute[];
export declare function parseBmlMeta(element: Element, typeFqn: string, file: string, loc: SourceLocation): {
    id: ExpressionValue | {
        kind: "literal";
        value: string;
        typeFqn: string;
    } | undefined;
    version: ExpressionValue | {
        kind: "literal";
        value: string;
        typeFqn: string;
    } | undefined;
    bean: ExpressionValue | {
        kind: "literal";
        value: string;
        typeFqn: string;
    } | undefined;
    scope: "local" | "context" | undefined;
};
//# sourceMappingURL=directives.d.ts.map