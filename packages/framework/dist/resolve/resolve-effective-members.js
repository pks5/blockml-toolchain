export function memberIdentityKey(member) {
    const ns = member.namespace ?? "";
    return `${ns}:${member.name}`;
}
export function collectBaseTypeChain(block, registry) {
    const chain = [];
    const visited = new Set();
    let current = block;
    while (current) {
        chain.unshift(current);
        const base = current.baseType;
        if (!base || visited.has(base)) {
            break;
        }
        visited.add(base);
        const parent = registry.get(base)?.block;
        if (!parent) {
            break;
        }
        current = parent;
    }
    return chain;
}
function mergeMemberPartial(existing, incoming) {
    const merged = { ...existing, ...incoming, name: incoming.name };
    if (existing.kind === "property" && incoming.kind === "property") {
        const existingConstraints = existing.constraints ?? [];
        const incomingConstraints = incoming.constraints ?? [];
        if (incomingConstraints.length > 0) {
            merged.constraints = [
                ...existingConstraints,
                ...incomingConstraints,
            ];
        }
        if (incoming.value !== undefined) {
            merged.value = incoming.value;
        }
        if (incoming.values !== undefined && incoming.values.length > 0) {
            merged.values = incoming.values;
        }
    }
    return merged;
}
function mergeMemberLayer(effective, members, treatAsOverride) {
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
export function resolveContracts(block, registry) {
    const effective = new Map();
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
export function resolveEffectiveMembers(block, registry) {
    const chain = collectBaseTypeChain(block, registry);
    const ancestors = chain.slice(0, -1);
    const effective = new Map();
    for (const layer of ancestors) {
        mergeMemberLayer(effective, layer.members, false);
    }
    mergeMemberLayer(effective, resolveContracts(block, registry), true);
    mergeMemberLayer(effective, block.members, true);
    return [...effective.values()];
}
export function findLocalMember(block, member) {
    const key = memberIdentityKey(member);
    return block.members.find((m) => memberIdentityKey(m) === key);
}
export function propertyForConstraintCheck(effective, local) {
    if (!local) {
        return effective;
    }
    const merged = { ...effective };
    if (local.value !== undefined) {
        merged.value = local.value;
    }
    if (local.values !== undefined && local.values.length > 0) {
        merged.values = local.values;
    }
    return merged;
}
//# sourceMappingURL=resolve-effective-members.js.map