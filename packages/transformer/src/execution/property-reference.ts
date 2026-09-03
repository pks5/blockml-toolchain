import type { PropertyDefinition } from "@blockml/bom";
import { resolveEffectiveMembers, type TypeRegistry } from "@blockml/framework";

const PROPERTIES_SEGMENT = ".properties.";

export function parsePropertyReference(
  raw: string,
): { blockFqn: string; propertyName: string } | undefined {
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

export function propertyTypeFqn(property: PropertyDefinition): string | undefined {
  if (property.typeFqn) {
    return property.typeFqn;
  }
  if (property.type?.kind === "named") {
    return property.type.fqn;
  }
  return undefined;
}

export function propertyLiteral(property: PropertyDefinition): unknown | undefined {
  const value = property.value ?? property.values?.[0]?.value;
  if (value?.kind === "literal") {
    return value.value;
  }
  return undefined;
}

export function lookupReferencedProperty(
  raw: string,
  registry: TypeRegistry,
  label: string,
):
  | { blockFqn: string; propertyName: string; property: PropertyDefinition }
  | { error: string } {
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
  const property = resolveEffectiveMembers(target.block, registry).find(
    (member): member is PropertyDefinition =>
      member.kind === "property" && member.name === parsed.propertyName,
  );
  if (!property) {
    return {
      error: `${label} property ${parsed.propertyName} was not found on ${parsed.blockFqn}`,
    };
  }
  return { ...parsed, property };
}
