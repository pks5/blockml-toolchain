import type {
  BlockDefinition,
  InstanceConfiguration,
  MemberDefinition,
  MemberValue,
  PropertyDefinition,
} from "@blockml/bom";
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

function mergeMemberPartial(
  existing: MemberDefinition,
  incoming: MemberDefinition,
): MemberDefinition {
  const merged = { ...existing, ...incoming, name: incoming.name } as MemberDefinition;

  if (existing.kind === "property" && incoming.kind === "property") {
    const existingConstraints = existing.constraints ?? [];
    const incomingConstraints = incoming.constraints ?? [];
    if (incomingConstraints.length > 0) {
      (merged as PropertyDefinition).constraints = [
        ...existingConstraints,
        ...incomingConstraints,
      ];
    }
    if (incoming.value !== undefined) {
      (merged as PropertyDefinition).value = incoming.value;
    }
    if (incoming.values !== undefined && incoming.values.length > 0) {
      (merged as PropertyDefinition).values = incoming.values;
    }
  }

  return merged;
}

function mergeMemberLayer(
  effective: Map<string, MemberDefinition>,
  members: MemberDefinition[],
  treatAsOverride: boolean,
): void {
  for (const member of members) {
    const key = memberIdentityKey(member);
    const existing = effective.get(key);
    if (!existing) {
      effective.set(key, member);
      continue;
    }
    if (member.override || treatAsOverride) {
      effective.set(key, mergeMemberPartial(existing, member));
    }
  }
}

/**
 * Merge members from block.contracts[] in declaration order.
 * Contract subBlocks/compositions/embeddedBlocks are ignored.
 */
export function resolveContracts(
  block: BlockDefinition,
  registry: TypeRegistry,
): MemberDefinition[] {
  const effective = new Map<string, MemberDefinition>();

  for (const ref of block.contracts ?? []) {
    const contractFqn = ref.value;
    const contractDoc = registry.get(contractFqn);
    if (!contractDoc) {
      continue;
    }
    mergeMemberLayer(effective, contractDoc.block.members, true);
  }

  return [...effective.values()];
}

/**
 * Merge members: baseType chain (ancestors) → contracts[] → local members.
 */
export function resolveEffectiveMembers(
  block: BlockDefinition,
  registry: TypeRegistry,
): MemberDefinition[] {
  const chain = collectBaseTypeChain(block, registry);
  const ancestors = chain.slice(0, -1);
  const effective = new Map<string, MemberDefinition>();

  for (const layer of ancestors) {
    mergeMemberLayer(effective, layer.members, false);
  }

  mergeMemberLayer(effective, resolveContracts(block, registry), true);
  mergeMemberLayer(effective, block.members, true);

  return applyBaseTypeInstanceConfiguration(block, [...effective.values()], registry);
}

export function findLocalMember(
  block: BlockDefinition,
  member: MemberDefinition,
): MemberDefinition | undefined {
  const key = memberIdentityKey(member);
  return block.members.find((m) => memberIdentityKey(m) === key);
}

export function propertyForConstraintCheck(
  effective: PropertyDefinition,
  local: PropertyDefinition | undefined,
): PropertyDefinition {
  if (!local) {
    return effective;
  }
  const merged: PropertyDefinition = { ...effective };
  if (local.value !== undefined) {
    merged.value = local.value;
  }
  if (local.values !== undefined && local.values.length > 0) {
    merged.values = local.values;
  }
  return merged;
}

function propertyHasBoundValue(prop: PropertyDefinition): boolean {
  if (prop.value !== undefined) {
    return true;
  }
  return (prop.values ?? []).some((entry) => entry.value !== undefined);
}

function applyInstanceConfigurationToMembers(
  members: MemberDefinition[],
  config: InstanceConfiguration,
  propertyOrder: PropertyDefinition[],
): MemberDefinition[] {
  const named: Record<string, MemberValue> = { ...(config.named ?? {}) };
  if (config.positional?.length) {
    for (let i = 0; i < config.positional.length; i++) {
      const target = propertyOrder[i];
      const value = config.positional[i];
      if (target && value !== undefined && named[target.name] === undefined) {
        named[target.name] = value;
      }
    }
  }

  return members.map((member) => {
    if (member.kind !== "property") {
      return member;
    }
    const bound = named[member.name];
    if (bound === undefined || propertyHasBoundValue(member)) {
      return member;
    }
    return { ...member, value: bound };
  });
}

function applyBaseTypeInstanceConfiguration(
  block: BlockDefinition,
  members: MemberDefinition[],
  registry: TypeRegistry,
): MemberDefinition[] {
  const expr = block.baseTypeExpression;
  if (!expr || expr.kind !== "named" || !expr.instanceConfiguration) {
    return members;
  }
  const baseDoc = registry.get(expr.fqn);
  const propertyOrder = (
    baseDoc ? resolveEffectiveMembers(baseDoc.block, registry) : members
  ).filter((m): m is PropertyDefinition => m.kind === "property");
  return applyInstanceConfigurationToMembers(
    members,
    expr.instanceConfiguration,
    propertyOrder,
  );
}
