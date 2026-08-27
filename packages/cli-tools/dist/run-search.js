import { isAbsolute, relative, resolve } from "node:path";
import { getIndexStatus, rebuildIndex, search as searchCorpus, } from "@blockml/search";
import { diagnosticKind, pushLines } from "./cli-style.js";
function displayPath(file, rootDir) {
    const abs = resolve(file);
    const rel = relative(rootDir, abs);
    return rel && !rel.startsWith("..") && !isAbsolute(rel) ? rel : file;
}
function formatScore(score) {
    return score.toFixed(2);
}
function formatHumanHit(hit, rootDir) {
    const file = displayPath(hit.file, rootDir);
    return `${formatScore(hit.score)}  ${hit.fqn}\n      ${file}`;
}
function printDiagnostics(diagnostics, lines, formatDiagnostic) {
    for (const d of diagnostics) {
        pushLines(lines, formatDiagnostic(d), diagnosticKind(d.severity));
    }
}
function searchOptions(parsed, config, rootDir) {
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
export async function runSearch(parsed, rootDir, config, lines, formatDiagnostic, usage) {
    const options = searchOptions(parsed, config, rootDir);
    if (parsed.index) {
        const built = await rebuildIndex(options);
        printDiagnostics(built.diagnostics, lines, formatDiagnostic);
        if (!parsed.json) {
            pushLines(lines, `Indexed ${built.documents} blocks.`, "success");
        }
        else {
            pushLines(lines, JSON.stringify({ documents: built.documents }, null, 2), "info");
        }
        return built.diagnostics.some((d) => d.severity === "error") ? 1 : 0;
    }
    const query = parsed.query?.trim() ?? "";
    if (!query) {
        pushLines(lines, "Specify a search query or `search index`.", "error");
        pushLines(lines, usage, "info");
        return 2;
    }
    if (!parsed.json) {
        const status = await getIndexStatus(options);
        if (status.state === "missing") {
            pushLines(lines, "Search index missing; building...", "info");
        }
        else if (status.state === "stale") {
            pushLines(lines, "Search index stale; rebuilding...", "info");
        }
    }
    const hits = await searchCorpus(query, {
        ...options,
        ...(parsed.limit !== undefined ? { limit: parsed.limit } : {}),
    });
    if (parsed.json) {
        pushLines(lines, JSON.stringify(hits, null, 2), "info");
        return 0;
    }
    if (hits.length === 0) {
        pushLines(lines, "No matches.", "info");
        return 0;
    }
    for (const hit of hits) {
        pushLines(lines, formatHumanHit(hit, rootDir), "info");
    }
    return 0;
}
//# sourceMappingURL=run-search.js.map