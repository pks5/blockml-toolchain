export function multiplicityLabel(multiplicity) {
    if (!multiplicity) {
        return undefined;
    }
    const max = multiplicity.max === "*" ? "n" : String(multiplicity.max);
    return `${multiplicity.min}..${max}`;
}
export function collectNamedTypes(expr) {
    if (!expr) {
        return [];
    }
    const out = [];
    walk(expr, undefined);
    return out;
    function walk(current, inherited) {
        switch (current.kind) {
            case "named": {
                const cardinality = multiplicityLabel(current.multiplicity) ?? inherited;
                const named = { fqn: current.fqn };
                if (cardinality) {
                    named.cardinality = cardinality;
                }
                out.push(named);
                for (const arg of current.typeArguments ?? []) {
                    walk(arg, undefined);
                }
                break;
            }
            case "union":
                for (const alternative of current.alternatives) {
                    walk(alternative, inherited);
                }
                break;
            case "grouped":
                walk(current.expression, multiplicityLabel(current.multiplicity) ?? inherited);
                break;
            case "anonymousStruct":
                for (const field of current.fields) {
                    walk(field.type, inherited);
                }
                break;
            case "genericParam":
            case "self":
                break;
        }
    }
}
//# sourceMappingURL=type-refs.js.map