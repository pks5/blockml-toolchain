import { collectBaseTypeChain, memberIdentityKey, resolveContracts, } from "@blockml/framework";
import { escapeHtml } from "./fqn-path.js";
import { renderTypeExpression, renderTypeRef } from "./type-links.js";
function simpleTypeName(typeFqn) {
    const base = typeFqn.split("<")[0]?.split("[")[0] ?? typeFqn;
    const segments = base.split(".");
    return segments[segments.length - 1] ?? base;
}
export function resolveSubBlockTypeFqn(block, typeName) {
    if (!typeName) {
        return undefined;
    }
    const simple = simpleTypeName(typeName);
    for (const sub of block.subBlocks) {
        if (sub.name === simple) {
            return sub.type;
        }
    }
    return undefined;
}
export function memberHasAuthoredType(member) {
    switch (member.kind) {
        case "property":
            return Boolean(member.typeFqn) || member.type !== undefined;
        case "capability":
            return Boolean(member.typeFqn);
        case "aggregation":
        case "association":
            return member.type !== undefined;
    }
}
export function resolveInheritedMemberType(member, block, registry) {
    if (memberHasAuthoredType(member) || !registry) {
        return { member, ownerBlock: block };
    }
    const key = memberIdentityKey(member);
    const fromContracts = (owner) => {
        return resolveContracts(owner, registry).find((candidate) => memberIdentityKey(candidate) === key && memberHasAuthoredType(candidate));
    };
    const contractOnSelf = fromContracts(block);
    if (contractOnSelf) {
        return { member: contractOnSelf, ownerBlock: block };
    }
    const ancestors = collectBaseTypeChain(block, registry).slice(0, -1).reverse();
    for (const ancestor of ancestors) {
        const declared = ancestor.members.find((candidate) => memberIdentityKey(candidate) === key);
        if (declared && memberHasAuthoredType(declared)) {
            return { member: declared, ownerBlock: ancestor };
        }
        const contracted = fromContracts(ancestor);
        if (contracted) {
            return { member: contracted, ownerBlock: ancestor };
        }
    }
    return { member, ownerBlock: block };
}
export function renderMemberTypeCell(member, block, pagePath, options, knownFqns, registry) {
    const resolved = resolveInheritedMemberType(member, block, registry);
    const typed = resolved.member;
    const owner = resolved.ownerBlock;
    if (typed.kind === "property") {
        const subBlockFqn = resolveSubBlockTypeFqn(owner, typed.typeFqn) ??
            resolveSubBlockTypeFqn(owner, typed.type?.kind === "named" ? typed.type.fqn : undefined);
        if (subBlockFqn) {
            return renderTypeRef(subBlockFqn, pagePath, options, knownFqns);
        }
        if (typed.typeFqn) {
            return renderTypeRef(typed.typeFqn, pagePath, options, knownFqns);
        }
        if (typed.type) {
            return renderTypeExpression(typed.type, pagePath, options, knownFqns);
        }
        return "—";
    }
    if (typed.kind === "capability") {
        if (typed.typeFqn) {
            return renderTypeRef(typed.typeFqn, pagePath, options, knownFqns);
        }
        return "capability";
    }
    if (typed.kind === "aggregation" || typed.kind === "association") {
        if (typed.type?.kind === "named") {
            const subBlockFqn = resolveSubBlockTypeFqn(owner, typed.type.fqn);
            if (subBlockFqn) {
                const suffix = typed.type.multiplicity
                    ? `[${typed.type.multiplicity.min}..${typed.type.multiplicity.max === "*" ? "*" : typed.type.multiplicity.max}]`
                    : "";
                return `${renderTypeRef(subBlockFqn, pagePath, options, knownFqns)}${suffix}`;
            }
        }
        return renderTypeExpression(typed.type, pagePath, options, knownFqns);
    }
    return "—";
}
export function renderMemberTable(title, members, block, pagePath, options, knownFqns, registry) {
    if (!members.length) {
        return "";
    }
    const rows = members
        .map((member) => `<tr><td>${escapeHtml(member.name)}</td><td>${renderMemberTypeCell(member, block, pagePath, options, knownFqns, registry)}</td></tr>`)
        .join("\n");
    return `<section><h2>${title}</h2><table><thead><tr><th>Name</th><th>Type</th></tr></thead><tbody>${rows}</tbody></table></section>`;
}
//# sourceMappingURL=member-sections.js.map