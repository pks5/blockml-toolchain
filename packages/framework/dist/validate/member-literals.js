import { resolveEffectiveMembers } from "../resolve/resolve-effective-members.js";
import { satisfiesTypeBound } from "../resolve/satisfies-type-bound.js";
import { evaluateParseValue } from "./evaluate-parse-value.js";
import { namedTypeFqn } from "./reference-kinds.js";
const ENUM_TYPE = "org.blockml.bml.type.EnumType";
/**
 * Declared property type for an instance member, when that type is in the registry.
 * Generic parameters and unknown types return undefined so the authored block FQN stays.
 */
export function resolveInstanceMemberType(ownerTypeFqn, memberName, registry) {
    const block = registry.get(ownerTypeFqn)?.block;
    if (!block) {
        return undefined;
    }
    const member = resolveEffectiveMembers(block, registry).find((m) => m.name === memberName);
    if (!member || member.kind !== "property") {
        return undefined;
    }
    const fqn = namedTypeFqn(member.type, member.typeFqn);
    if (!fqn || !registry.has(fqn)) {
        return undefined;
    }
    return fqn;
}
/** Member ids of an EnumType, or undefined when `typeFqn` is not an enum. */
export function enumMemberIds(typeFqn, registry) {
    if (!registry.has(typeFqn) || !satisfiesTypeBound(typeFqn, ENUM_TYPE, registry)) {
        return undefined;
    }
    const block = registry.get(typeFqn)?.block;
    if (!block) {
        return undefined;
    }
    const values = resolveEffectiveMembers(block, registry).find((member) => member.kind === "aggregation" && member.name === "values");
    const ids = new Set();
    if (values?.kind === "aggregation" && values.composition) {
        collectEnumIds(values.composition.children, ids);
    }
    return ids;
}
/**
 * Bare member id for an authored enum token.
 * Accepts the id and `{EnumTypeFQN}::id`. Unknown tokens return undefined.
 */
export function canonicalEnumId(enumFqn, raw, ids) {
    const token = raw.trim();
    if (ids.has(token)) {
        return token;
    }
    const prefix = `${enumFqn}::`;
    if (token.startsWith(prefix)) {
        const id = token.slice(prefix.length).trim();
        if (id && ids.has(id)) {
            return id;
        }
    }
    return undefined;
}
/**
 * Re-parse instance literals with the member type. Same-file types are visible
 * when `registry` is an overlay that already contains `document`.
 */
export function applyInstanceMemberTypes(document, registry) {
    walkBlocks(document.block, (block) => {
        forEachInstance(block, (instance) => {
            for (const [name, val] of Object.entries(instance.memberValues)) {
                if (val.kind !== "literal") {
                    continue;
                }
                const memberType = resolveInstanceMemberType(instance.typeFqn, name, registry);
                if (!memberType) {
                    continue;
                }
                if (typeof val.value === "string") {
                    const result = evaluateParseValue(memberType, val.value, registry);
                    if (result.ok && "value" in result) {
                        val.value = result.value;
                    }
                }
                val.typeFqn = memberType;
            }
        });
    });
}
/** Store EnumType property and instance literals as the member id. */
export function canonicalizeEnumLiterals(document, registry) {
    walkBlocks(document.block, (block) => {
        for (const member of block.members) {
            if (member.kind !== "property") {
                continue;
            }
            const memberType = namedTypeFqn(member.type, member.typeFqn);
            if (!memberType) {
                continue;
            }
            if (member.value?.kind === "literal") {
                rewriteEnumLiteral(member.value, memberType, registry);
            }
            for (const entry of member.values ?? []) {
                if (entry.namespace) {
                    continue;
                }
                if (entry.value.kind === "literal") {
                    rewriteEnumLiteral(entry.value, memberType, registry);
                }
            }
        }
        forEachInstance(block, (instance) => {
            for (const [name, val] of Object.entries(instance.memberValues)) {
                if (val.kind !== "literal") {
                    continue;
                }
                const memberType = resolveInstanceMemberType(instance.typeFqn, name, registry);
                if (!memberType) {
                    continue;
                }
                rewriteEnumLiteral(val, memberType, registry);
            }
        });
    });
}
/** Instance scalars and enum ids, including types declared on `document` itself. */
export function normalizeParsedMemberValues(document, registry) {
    const overlay = registry.withOverlay(document);
    applyInstanceMemberTypes(document, overlay);
    canonicalizeEnumLiterals(document, overlay);
}
function rewriteEnumLiteral(val, memberType, registry) {
    const ids = enumMemberIds(memberType, registry);
    if (!ids) {
        return;
    }
    if (typeof val.value === "string") {
        const id = canonicalEnumId(memberType, val.value, ids);
        if (id) {
            val.value = id;
        }
        return;
    }
    if (Array.isArray(val.value)) {
        val.value = val.value.map((item) => {
            if (typeof item !== "string") {
                return item;
            }
            return canonicalEnumId(memberType, item, ids) ?? item;
        });
    }
}
function collectEnumIds(nodes, ids) {
    for (const node of nodes) {
        if (node.kind === "blockInstance") {
            const id = node.instance.id;
            if (id?.kind === "literal" && typeof id.value === "string" && id.value.trim()) {
                ids.add(id.value.trim());
            }
            continue;
        }
        collectEnumIds(node.children, ids);
    }
}
function walkBlocks(block, visit) {
    visit(block);
    for (const sub of block.subBlocks) {
        walkBlocks(sub, visit);
    }
    for (const embedded of block.embeddedBlocks) {
        walkBlocks(embedded, visit);
    }
}
function forEachInstance(block, visit) {
    for (const member of block.members) {
        if (member.kind === "property") {
            for (const suggestion of member.suggestions ?? []) {
                visit(suggestion);
            }
        }
        for (const constraint of member.constraints ?? []) {
            visit(constraint);
        }
    }
    for (const constraint of block.constraints ?? []) {
        visit(constraint);
    }
    for (const template of block.compositions) {
        eachNode(template.children, visit);
    }
}
function eachNode(nodes, visit) {
    for (const node of nodes) {
        if (node.kind === "blockInstance") {
            visit(node.instance);
            for (const agg of node.instance.aggregationCompositions ?? []) {
                eachNode(agg.composition.children, visit);
            }
            continue;
        }
        eachNode(node.children, visit);
    }
}
//# sourceMappingURL=member-literals.js.map