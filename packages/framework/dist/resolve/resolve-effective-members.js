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
function applyLocalDeclarationFlags(merged, incoming) {
    if (incoming.abstract === true) {
        merged.abstract = true;
    }
    else {
        delete merged.abstract;
    }
    if (incoming.final === true) {
        merged.final = true;
    }
    else {
        delete merged.final;
    }
    if (incoming.override === true) {
        merged.override = true;
    }
    else {
        delete merged.override;
    }
}
function mergeMemberPartial(existing, incoming) {
    const merged = { ...existing, ...incoming, name: incoming.name };
    applyLocalDeclarationFlags(merged, incoming);
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
    return applyBaseTypeInstanceConfiguration(block, [...effective.values()], registry);
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
function propertyHasBoundValue(prop) {
    if (prop.value !== undefined) {
        return true;
    }
    return (prop.values ?? []).some((entry) => entry.value !== undefined);
}
function applyInstanceConfigurationToMembers(members, config, propertyOrder) {
    const named = { ...(config.named ?? {}) };
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
function applyBaseTypeInstanceConfiguration(block, members, registry) {
    const expr = block.baseTypeExpression;
    if (!expr || expr.kind !== "named" || !expr.instanceConfiguration) {
        return members;
    }
    const baseDoc = registry.get(expr.fqn);
    const propertyOrder = (baseDoc ? resolveEffectiveMembers(baseDoc.block, registry) : members).filter((m) => m.kind === "property");
    return applyInstanceConfigurationToMembers(members, expr.instanceConfiguration, propertyOrder);
}
//# sourceMappingURL=resolve-effective-members.js.map