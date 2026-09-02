import { isAbsolute, relative, resolve } from "node:path";
import { projectSourceRoots } from "@blockml/framework";
import { collectNamedTypes } from "./type-refs.js";
function fqnToPackagePrefix(fqn) {
    const segments = fqn.split(".");
    return segments.length > 1 ? segments.slice(0, -1).join(".") : fqn;
}
function lastSegment(fqn) {
    const parts = fqn.split(".");
    return parts[parts.length - 1] || fqn;
}
function isPathInside(inner, outer) {
    const a = resolve(inner);
    const b = resolve(outer);
    const rel = relative(b, a);
    return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}
function originForFile(filePath, workspaceRoots) {
    if (!filePath) {
        return "unresolved";
    }
    for (const root of workspaceRoots) {
        if (isPathInside(filePath, root)) {
            return "workspace";
        }
    }
    return "dependency";
}
function locFile(source, fallback) {
    return source?.file || fallback;
}
function locLine(source) {
    return source?.line ?? 0;
}
function memberId(ownerFqn, kind, name) {
    return `${ownerFqn}#${kind}:${name}`;
}
function addBlock(blocks, block) {
    const existing = blocks.get(block.fqn);
    if (existing?.resolved && !block.resolved) {
        return;
    }
    if (existing && existing.resolved === block.resolved) {
        return;
    }
    const mapped = {
        fqn: block.fqn,
        name: block.name,
        file: block.file,
        library: block.library ?? fqnToPackagePrefix(block.fqn),
        origin: block.origin,
        resolved: block.resolved,
        abstract: block.abstract,
    };
    blocks.set(block.fqn, mapped);
}
function ensureTarget(blocks, fqn) {
    if (blocks.has(fqn)) {
        return;
    }
    addBlock(blocks, {
        fqn,
        name: lastSegment(fqn),
        file: "",
        origin: "unresolved",
        resolved: false,
        abstract: false,
    });
}
function addEdge(edges, edge) {
    edges.push(edge);
}
function typeEdgesFromNamed(relation, from, refs, file, line, blocks, edges, workspaceRoots) {
    const seen = new Set();
    for (const ref of refs) {
        if (!ref.fqn || seen.has(ref.fqn)) {
            continue;
        }
        seen.add(ref.fqn);
        ensureTarget(blocks, ref.fqn);
        const edge = {
            relation,
            from,
            to: ref.fqn,
            file,
            line,
            cardinality: ref.cardinality ?? "",
        };
        addEdge(edges, edge);
    }
}
function memberTypeRefs(member) {
    switch (member.kind) {
        case "property": {
            if (member.type) {
                const fromExpr = collectNamedTypes(member.type);
                if (fromExpr.length > 0) {
                    return fromExpr;
                }
            }
            return member.typeFqn ? [{ fqn: member.typeFqn }] : [];
        }
        case "aggregation": {
            const refs = collectNamedTypes(member.type);
            if (member.cardinality) {
                return refs.map((ref) => {
                    const named = { fqn: ref.fqn };
                    const cardinality = ref.cardinality ?? member.cardinality;
                    if (cardinality) {
                        named.cardinality = cardinality;
                    }
                    return named;
                });
            }
            return refs;
        }
        case "association":
            return collectNamedTypes(member.type);
        case "capability": {
            const refs = [];
            if (member.typeFqn) {
                refs.push({ fqn: member.typeFqn });
            }
            return refs;
        }
    }
}
function capabilityTypeEdges(member, memberKey, file, line, blocks, edges, workspaceRoots) {
    typeEdgesFromNamed("INPUT_TYPE", memberKey, collectNamedTypes(member.inputType), file, locLine(member.inputTypeSource) || line, blocks, edges, workspaceRoots);
    typeEdgesFromNamed("OUTPUT_TYPE", memberKey, collectNamedTypes(member.outputType), file, locLine(member.outputTypeSource) || line, blocks, edges, workspaceRoots);
    const throwsRefs = (member.throws ?? [])
        .map((entry) => entry.value?.trim())
        .filter((value) => Boolean(value))
        .map((fqn) => ({ fqn }));
    typeEdgesFromNamed("THROWS", memberKey, throwsRefs, file, line, blocks, edges, workspaceRoots);
}
function mapMembers(owner, file, origin, blocks, members, edges, workspaceRoots) {
    const ownerFqn = owner.type;
    if (!ownerFqn) {
        return;
    }
    for (const member of owner.members) {
        const kind = member.kind;
        const id = memberId(ownerFqn, kind, member.name);
        const memberFile = locFile(member.source, file);
        const memberLine = locLine(member.source);
        members.push({
            id,
            ownerFqn,
            name: member.name,
            kind,
            displayFqn: `${ownerFqn}.${member.name}`,
            file: memberFile,
            line: memberLine,
            origin,
        });
        addEdge(edges, {
            relation: "HAS_MEMBER",
            from: ownerFqn,
            to: id,
            file: memberFile,
            line: memberLine,
            cardinality: "",
        });
        typeEdgesFromNamed("MEMBER_TYPE", id, memberTypeRefs(member), locFile(member.typeSource, memberFile), locLine(member.typeSource) || memberLine, blocks, edges, workspaceRoots);
        if (member.kind === "capability") {
            capabilityTypeEdges(member, id, memberFile, memberLine, blocks, edges, workspaceRoots);
        }
    }
}
function mapBlockRelations(block, file, blocks, edges, workspaceRoots) {
    const fqn = block.type;
    if (!fqn) {
        return;
    }
    const baseRefs = block.baseTypeExpression
        ? collectNamedTypes(block.baseTypeExpression)
        : block.baseType
            ? [{ fqn: block.baseType }]
            : [];
    typeEdgesFromNamed("BASE_TYPE", fqn, baseRefs, locFile(block.baseTypeSource, file), locLine(block.baseTypeSource), blocks, edges, workspaceRoots);
    const contractRefs = (block.contracts ?? [])
        .map((entry) => entry.value?.trim())
        .filter((value) => Boolean(value))
        .map((value) => ({ fqn: value }));
    typeEdgesFromNamed("CONTRACT", fqn, contractRefs, file, locLine(block.source), blocks, edges, workspaceRoots);
    for (const sub of block.subBlocks) {
        if (!sub.type) {
            continue;
        }
        addEdge(edges, {
            relation: "HAS_SUBBLOCK",
            from: fqn,
            to: sub.type,
            file: locFile(sub.source, file),
            line: locLine(sub.source),
            cardinality: "",
        });
    }
}
export function graphDataFromRegistry(registry, options = {}) {
    const rootDir = options.rootDir ?? process.cwd();
    const workspaceRoots = projectSourceRoots(rootDir, options.srcDir);
    const blocks = new Map();
    const members = [];
    const edges = [];
    for (const fqn of registry.keys()) {
        const doc = registry.get(fqn);
        const block = doc?.block;
        if (!block?.type || !block.name) {
            continue;
        }
        const file = doc?.source?.filePath ?? locFile(block.source, fqn);
        const origin = originForFile(file, workspaceRoots);
        addBlock(blocks, {
            fqn: block.type,
            name: block.name,
            file,
            origin,
            resolved: true,
            abstract: block.abstract === true,
        });
    }
    for (const fqn of registry.keys()) {
        const doc = registry.get(fqn);
        const block = doc?.block;
        if (!block?.type) {
            continue;
        }
        const file = doc?.source?.filePath ?? locFile(block.source, fqn);
        const origin = originForFile(file, workspaceRoots);
        mapBlockRelations(block, file, blocks, edges, workspaceRoots);
        mapMembers(block, file, origin, blocks, members, edges, workspaceRoots);
    }
    const filePaths = [
        ...new Set([...blocks.values()]
            .map((block) => block.file)
            .filter((file) => Boolean(file))),
    ].sort();
    return {
        blocks: [...blocks.values()].sort((a, b) => a.fqn.localeCompare(b.fqn)),
        members: members.sort((a, b) => a.id.localeCompare(b.id)),
        edges,
        filePaths,
    };
}
//# sourceMappingURL=mapper.js.map