import type { BlockDefinition, MemberDefinition } from "@blockml/bom";
import type { TypeRegistry } from "../registry/type-registry.js";

export function memberIdentityKey(member: MemberDefinition): string {
  const ns = member.namespace ?? "";
  return `${ns}:${member.name}`;
}

export function collectBaseTypeChain(
  block: BlockDefinition,
  registry: TypeRegistry,
): BlockDefinition[] {
  const chain: BlockDefinition[] = [];
  const visited = new Set<string>();
  let current: BlockDefinition | undefined = block;

  while (current) {
    chain.unshift(current);
    const base: string | undefined = current.baseType;
    if (!base || visited.has(base)) {
      break;
    }
    visited.add(base);
    const parent: BlockDefinition | undefined = registry.get(base)?.block;
    if (!parent) {
      break;
    }
    current = parent;
  }

  return chain;
}

/**
 * Merge members along baseType chain + local declarations.
 * Later layers override earlier when override=true or same identity replaces.
 */
export function resolveEffectiveMembers(
  block: BlockDefinition,
  registry: TypeRegistry,
): MemberDefinition[] {
  const chain = collectBaseTypeChain(block, registry);
  const effective = new Map<string, MemberDefinition>();

  for (const layer of chain) {
    for (const member of layer.members) {
      const key = memberIdentityKey(member);
      const existing = effective.get(key);
      if (!existing) {
        effective.set(key, member);
        continue;
      }
      if (member.override) {
        effective.set(key, { ...existing, ...member, name: member.name });
      }
    }
  }

  return [...effective.values()];
}
