import { isAbsolute, relative, resolve } from "node:path";
import { getIndexStatus, GRAPH_RELATIONS, openGraph, rebuildIndex, } from "@blockml/graph";
import { diagnosticKind, pushLines } from "./cli-style.js";
import { suggestMatchingFqn, unknownFqnMessage } from "./suggest-fqn.js";
export const GRAPH_SUBCOMMANDS = [
    "index",
    "neighbors",
    "uses",
    "used-by",
    "ancestors",
    "descendants",
    "members",
    "path",
    "query",
    "schema",
];
function displayPath(file, rootDir) {
    if (!file) {
        return "";
    }
    const abs = resolve(file);
    const rel = relative(rootDir, abs);
    return rel && !rel.startsWith("..") && !isAbsolute(rel) ? rel : file;
}
function graphOptions(parsed, config, rootDir) {
    const options = { rootDir };
    const srcDir = parsed.srcDir ?? config.srcDir;
    if (srcDir) {
        options.srcDir = srcDir;
    }
    const libraries = parsed.libraries ?? config.libraries;
    if (libraries) {
        options.libraries = libraries;
    }
    return options;
}
function printDiagnostics(diagnostics, lines, formatDiagnostic) {
    for (const d of diagnostics) {
        pushLines(lines, formatDiagnostic(d), diagnosticKind(d.severity));
    }
}
function loc(file, line, rootDir) {
    if (!file) {
        return "";
    }
    const path = displayPath(file, rootDir);
    return line && line > 0 ? `${path}:${line}` : path;
}
function formatNode(node, rootDir) {
    const label = node.displayFqn ?? node.fqn;
    const where = loc(node.file, undefined, rootDir);
    return where ? `${label}  ${where}` : label;
}
function formatNeighbor(hit, rootDir) {
    const via = hit.via ? ` via ${hit.via.displayFqn ?? hit.via.fqn}` : "";
    const source = hit.source ? ` from ${hit.source.displayFqn ?? hit.source.fqn}` : "";
    const where = loc(hit.file, hit.line, rootDir);
    const suffix = where ? `  ${where}` : "";
    return `${hit.direction}  ${hit.relation}${via}  ${formatNode(hit.node, rootDir)}${source}${suffix}`;
}
function formatMember(member, rootDir) {
    const inherited = member.inheritedFrom ? ` inheritedFrom ${member.inheritedFrom}` : "";
    const where = loc(member.file, member.line, rootDir);
    const suffix = where ? `  ${where}` : "";
    return `${member.node.displayFqn ?? member.node.fqn}${inherited}${suffix}`;
}
function formatPath(path, rootDir) {
    const lines = [formatNode(path.from, rootDir)];
    for (const hop of path.hops) {
        const arrow = hop.direction === "incoming" ? `<--${hop.relation}--` : `--${hop.relation}-->`;
        const where = loc(hop.file, hop.line, rootDir);
        const suffix = where ? `  ${where}` : "";
        lines.push(`  ${arrow} ${formatNode(hop.node, rootDir)}${suffix}`);
    }
    return lines.join("\n");
}
function emitJson(lines, value) {
    pushLines(lines, JSON.stringify(value, null, 2), "info");
}
async function withIndex(parsed, config, rootDir, lines, formatDiagnostic, run) {
    const options = graphOptions(parsed, config, rootDir);
    if (!parsed.json) {
        const status = await getIndexStatus(options);
        if (status.state === "missing") {
            pushLines(lines, "Graph index missing; building...", "info");
        }
        else if (status.state === "stale") {
            pushLines(lines, "Graph index stale; rebuilding...", "info");
        }
    }
    const opened = await openGraph(options);
    printDiagnostics(opened.diagnostics, lines, formatDiagnostic);
    try {
        return await run(opened.index);
    }
    finally {
        await opened.index.close();
    }
}
function requireFqn(parsed, lines, usage) {
    const fqn = parsed.graphFqn?.trim() ?? "";
    if (!fqn) {
        pushLines(lines, "Specify a block FQN.", "error");
        pushLines(lines, usage, "info");
        return undefined;
    }
    return fqn;
}
async function rejectUnknownFqn(index, fqn, lines, parsed, rootDir, config) {
    const node = await index.block(fqn);
    if (node) {
        return false;
    }
    const suggestion = await suggestMatchingFqn(fqn, {
        rootDir,
        ...(parsed.srcDir !== undefined || config.srcDir !== undefined
            ? { srcDir: parsed.srcDir ?? config.srcDir }
            : {}),
        ...(parsed.libraries !== undefined || config.libraries !== undefined
            ? { libraries: parsed.libraries ?? config.libraries }
            : {}),
    });
    pushLines(lines, unknownFqnMessage(fqn, suggestion), "error");
    return true;
}
const GRAPH_ORIGINS = ["workspace", "dependency", "unresolved"];
function splitCsv(raw) {
    return (raw ?? "")
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
}
function applyNeighborFilters(hits, parsed, lines) {
    let out = hits;
    const origins = splitCsv(parsed.origin);
    if (origins.length > 0) {
        const allowed = new Set(GRAPH_ORIGINS);
        const bad = origins.find((value) => !allowed.has(value));
        if (bad) {
            pushLines(lines, `Unknown origin: ${bad}. Use workspace, dependency, or unresolved.`, "error");
            return undefined;
        }
        const wanted = new Set(origins);
        out = out.filter((hit) => wanted.has(hit.node.origin));
    }
    const relations = splitCsv(parsed.relation);
    if (relations.length > 0) {
        const allowed = new Set(GRAPH_RELATIONS);
        const bad = relations.find((value) => !allowed.has(value));
        if (bad) {
            pushLines(lines, `Unknown relation: ${bad}. Use ${GRAPH_RELATIONS.join(", ")}.`, "error");
            return undefined;
        }
        const wanted = new Set(relations);
        out = out.filter((hit) => wanted.has(hit.relation));
    }
    if (parsed.limit !== undefined) {
        out = out.slice(0, parsed.limit);
    }
    return out;
}
export async function runGraph(parsed, rootDir, config, lines, formatDiagnostic, usage) {
    const subcommand = parsed.subcommand;
    if (!subcommand || !GRAPH_SUBCOMMANDS.includes(subcommand)) {
        if (!subcommand) {
            pushLines(lines, "Specify a graph subcommand.", "error");
        }
        else {
            pushLines(lines, `Unknown graph subcommand: ${subcommand}.`, "error");
        }
        pushLines(lines, usage, "info");
        return 2;
    }
    const options = graphOptions(parsed, config, rootDir);
    const depthOptions = parsed.depth !== undefined ? { depth: parsed.depth } : {};
    if (subcommand === "index") {
        const built = await rebuildIndex(options);
        printDiagnostics(built.diagnostics, lines, formatDiagnostic);
        if (parsed.json) {
            emitJson(lines, { blocks: built.blocks, members: built.members });
        }
        else {
            pushLines(lines, `Indexed ${built.blocks} blocks, ${built.members} members.`, "success");
        }
        await built.index.close();
        return built.diagnostics.some((d) => d.severity === "error") ? 1 : 0;
    }
    return withIndex(parsed, config, rootDir, lines, formatDiagnostic, async (index) => {
        if (subcommand === "schema") {
            const schema = index.schema();
            if (parsed.json) {
                emitJson(lines, schema);
            }
            else {
                pushLines(lines, `nodes: ${schema.nodes.join(", ")}`, "info");
                pushLines(lines, `relations: ${schema.relations.join(", ")}`, "info");
                pushLines(lines, schema.description, "info");
                pushLines(lines, `example: ${schema.example}`, "info");
            }
            return 0;
        }
        if (subcommand === "query") {
            const cypher = parsed.query?.trim() ?? "";
            if (!cypher) {
                pushLines(lines, "Specify a Cypher query.", "error");
                pushLines(lines, usage, "info");
                return 2;
            }
            const result = await index.query(cypher);
            if (parsed.json) {
                emitJson(lines, result);
                return 0;
            }
            if (result.rows.length === 0) {
                pushLines(lines, "No rows.", "info");
                return 0;
            }
            pushLines(lines, result.columns.join("\t"), "info");
            for (const row of result.rows) {
                pushLines(lines, row.values.map((value) => String(value ?? "")).join("\t"), "info");
            }
            return 0;
        }
        if (subcommand === "path") {
            const from = parsed.graphFqn?.trim() ?? "";
            const to = parsed.graphTo?.trim() ?? "";
            if (!from || !to) {
                pushLines(lines, "Specify from and to FQNs.", "error");
                pushLines(lines, usage, "info");
                return 2;
            }
            if ((await rejectUnknownFqn(index, from, lines, parsed, rootDir, config)) ||
                (await rejectUnknownFqn(index, to, lines, parsed, rootDir, config))) {
                return 2;
            }
            const path = await index.path(from, to, depthOptions);
            if (parsed.json) {
                emitJson(lines, path ?? null);
                return 0;
            }
            if (!path) {
                pushLines(lines, "No path.", "info");
                return 0;
            }
            pushLines(lines, formatPath(path, rootDir), "info");
            return 0;
        }
        const fqn = requireFqn(parsed, lines, usage);
        if (!fqn) {
            return 2;
        }
        if (await rejectUnknownFqn(index, fqn, lines, parsed, rootDir, config)) {
            return 2;
        }
        if (subcommand === "members") {
            const members = await index.members(fqn);
            if (parsed.json) {
                emitJson(lines, members);
                return 0;
            }
            if (members.length === 0) {
                pushLines(lines, "No members.", "info");
                return 0;
            }
            for (const member of members) {
                pushLines(lines, formatMember(member, rootDir), "info");
            }
            return 0;
        }
        if (subcommand === "ancestors" || subcommand === "descendants") {
            const nodes = subcommand === "ancestors"
                ? await index.ancestors(fqn, depthOptions)
                : await index.descendants(fqn, depthOptions);
            if (parsed.json) {
                emitJson(lines, nodes);
                return 0;
            }
            if (nodes.length === 0) {
                pushLines(lines, "No matches.", "info");
                return 0;
            }
            for (const node of nodes) {
                pushLines(lines, formatNode(node, rootDir), "info");
            }
            return 0;
        }
        const neighbors = subcommand === "uses"
            ? await index.uses(fqn, depthOptions)
            : subcommand === "used-by"
                ? await index.usedBy(fqn, depthOptions)
                : await index.neighbors(fqn, depthOptions);
        const filtered = applyNeighborFilters(neighbors, parsed, lines);
        if (!filtered) {
            return 2;
        }
        if (parsed.json) {
            emitJson(lines, filtered);
            return 0;
        }
        if (filtered.length === 0) {
            pushLines(lines, "No matches.", "info");
            return 0;
        }
        for (const hit of filtered) {
            pushLines(lines, formatNeighbor(hit, rootDir), "info");
        }
        return 0;
    });
}
//# sourceMappingURL=run-graph.js.map