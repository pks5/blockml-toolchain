import { fqnToQName, hasBmlSemanticQNameBindings } from "./qname.js";
export function emitTypeExpression(type, bindings, useQName) {
    switch (type.kind) {
        case "self":
            return "bml:Self";
        case "genericParam":
            return type.name;
        case "anonymousStruct":
            return `{ ${type.fields.map((f) => `${f.name}: ${emitTypeExpression(f.type, bindings, useQName)}`).join(", ")} }`;
        case "union":
            return type.alternatives
                .map((a) => emitTypeExpression(a, bindings, useQName))
                .join(" | ");
        case "named": {
            let base = useQName ? fqnToQName(type.fqn, bindings) : type.fqn;
            if (type.typeArguments?.length) {
                base += `(${type.typeArguments.map((a) => emitTypeExpression(a, bindings, useQName)).join(", ")})`;
            }
            if (type.instanceConfiguration?.named) {
                const pairs = Object.entries(type.instanceConfiguration.named).map(([k, v]) => `${k}: ${emitConfigValue(v)}`);
                base += `{ ${pairs.join(", ")} }`;
            }
            else if (type.instanceConfiguration?.positional?.length) {
                base += `{ ${type.instanceConfiguration.positional.map(emitConfigValue).join(", ")} }`;
            }
            if (type.multiplicity) {
                const { min, max } = type.multiplicity;
                if (min === 0 && max === "*") {
                    base += "[]";
                }
                else if (min === max) {
                    base += `[${min}]`;
                }
                else {
                    base += `[${min}..${max}]`;
                }
            }
            return base;
        }
    }
}
function emitConfigValue(v) {
    if (v.kind === "expression") {
        return `\${ ${v.raw} }`;
    }
    if (typeof v.value === "string") {
        return `"${v.value}"`;
    }
    return String(v.value);
}
export function shouldUseQName(bindings) {
    return hasBmlSemanticQNameBindings(bindings);
}
export { fqnToQName };
//# sourceMappingURL=type-expression.js.map