import type { TypeRegistry } from "../registry/type-registry.js";
export type EvaluateParseValueResult = {
    ok: true;
    value: unknown;
} | {
    ok: true;
    skipped: true;
} | {
    ok: false;
    message: string;
};
export declare function evaluateParseValue(typeFqn: string, raw: string, registry: TypeRegistry): EvaluateParseValueResult;
//# sourceMappingURL=evaluate-parse-value.d.ts.map