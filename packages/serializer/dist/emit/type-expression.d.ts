import type { TypeExpression } from "@blockml/bom";
import { fqnToQName } from "./qname.js";
export declare function emitTypeExpression(type: TypeExpression, bindings: Record<string, string>, useQName: boolean): string;
export declare function shouldUseQName(bindings: Record<string, string>): boolean;
export { fqnToQName };
//# sourceMappingURL=type-expression.d.ts.map