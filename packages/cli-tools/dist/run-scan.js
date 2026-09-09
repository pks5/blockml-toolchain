import { bootstrapFullProjectRegistry, scanPackages, scanTypes, } from "@blockml/framework";
import { pushLines } from "./cli-style.js";
const SCAN_KINDS = new Set(["package", "type"]);
function scanCorpus(kind, selectors, rootDir, parsed, config) {
    const bootstrap = bootstrapFullProjectRegistry({
        rootDir,
        ...(parsed.srcDir !== undefined || config.srcDir !== undefined
            ? { srcDir: parsed.srcDir ?? config.srcDir }
            : {}),
        ...(parsed.libraries !== undefined || config.libraries !== undefined
            ? { libraries: parsed.libraries ?? config.libraries }
            : {}),
    });
    return kind === "package"
        ? scanPackages(selectors, bootstrap.registry)
        : scanTypes(selectors, bootstrap.registry);
}
export function runScan(parsed, rootDir, config, lines, usage) {
    const kind = parsed.subcommand?.trim() ?? "";
    if (!SCAN_KINDS.has(kind)) {
        if (!kind) {
            pushLines(lines, "Specify a scan subcommand: package or type.", "error");
        }
        else {
            pushLines(lines, `Unknown scan subcommand: ${kind}.`, "error");
        }
        pushLines(lines, usage, "info");
        return 2;
    }
    const selectors = (parsed.selectors ?? []).map((s) => s.trim()).filter(Boolean);
    if (selectors.length === 0) {
        pushLines(lines, "Specify one or more selectors.", "error");
        pushLines(lines, usage, "info");
        return 2;
    }
    const result = scanCorpus(kind, selectors, rootDir, parsed, config);
    if (!result.ok) {
        pushLines(lines, result.message, "error");
        pushLines(lines, usage, "info");
        return 2;
    }
    if (parsed.json) {
        pushLines(lines, JSON.stringify(result.hits, null, 2), "info");
        return 0;
    }
    if (result.hits.length === 0) {
        pushLines(lines, "No matches.", "info");
        return 0;
    }
    for (const hit of result.hits) {
        pushLines(lines, hit, "info");
    }
    return 0;
}
//# sourceMappingURL=run-scan.js.map