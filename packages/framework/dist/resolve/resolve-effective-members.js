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
/**
 * Merge members along baseType chain + local declarations.
 * Later layers override earlier when override=true or same identity replaces.
 */
export function resolveEffectiveMembers(block, registry) {
    const chain = collectBaseTypeChain(block, registry);
    const effective = new Map();
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
//# sourceMappingURL=resolve-effective-members.js.map