import { resolveEffectiveMembers } from "@blockml/framework";
const PROPERTIES_SEGMENT = ".properties.";
export function parsePropertyReference(raw) {
    const index = raw.lastIndexOf(PROPERTIES_SEGMENT);
    if (index <= 0) {
        return undefined;
    }
    const blockFqn = raw.slice(0, index);
    const propertyName = raw.slice(index + PROPERTIES_SEGMENT.length);
    if (!blockFqn || !propertyName || propertyName.includes(".")) {
        return undefined;
    }
    return { blockFqn, propertyName };
}
export function propertyTypeFqn(property) {
    if (property.typeFqn) {
        return property.typeFqn;
    }
    if (property.type?.kind === "named") {
        return property.type.fqn;
    }
    return undefined;
}
export function propertyLiteral(property) {
    const value = property.value ?? property.values?.[0]?.value;
    if (value?.kind === "literal") {
        return value.value;
    }
    return undefined;
}
export function lookupReferencedProperty(raw, registry, label) {
    const parsed = parsePropertyReference(raw);
    if (!parsed) {
        return {
            error: `${label} "${raw}" is not a valid PropertyReference (expected BlockFqn.properties.name)`,
        };
    }
    const target = registry.get(parsed.blockFqn);
    if (!target) {
        return { error: `${label} block ${parsed.blockFqn} was not found` };
    }
    const property = resolveEffectiveMembers(target.block, registry).find((member) => member.kind === "property" && member.name === parsed.propertyName);
    if (!property) {
        return {
            error: `${label} property ${parsed.propertyName} was not found on ${parsed.blockFqn}`,
        };
    }
    return { ...parsed, property };
}
//# sourceMappingURL=property-reference.js.map