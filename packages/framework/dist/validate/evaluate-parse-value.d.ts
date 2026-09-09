import type { TypeRegistry } from "../registry/type-registry.js";
export type EvaluateCapabilityResult = {
    ok: true;
    value: unknown;
} | {
    ok: true;
    skipped: true;
} | {
    ok: false;
    message: string;
};
export type EvaluateParseValueResult = EvaluateCapabilityResult;
export declare function evaluateCapability(typeFqn: string, capabilityName: string, args: unknown[], registry: TypeRegistry): EvaluateCapabilityResult;
export declare function evaluateParseValue(typeFqn: string, raw: string, registry: TypeRegistry): EvaluateParseValueResult;
//# sourceMappingURL=evaluate-parse-value.d.ts.map