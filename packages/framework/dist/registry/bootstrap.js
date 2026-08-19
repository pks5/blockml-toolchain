import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parse } from "@blockml/parser";
import { TypeRegistry } from "./type-registry.js";
function collectBmlFiles(dir, out = []) {
    let entries;
    try {
        entries = readdirSync(dir);
    }
    catch {
        return out;
    }
    for (const entry of entries) {
        const full = join(dir, entry);
        try {
            const st = statSync(full);
            if (st.isDirectory()) {
                collectBmlFiles(full, out);
            }
            else if (entry.endsWith(".bml")) {
                out.push(full);
            }
        }
        catch {
            continue;
        }
    }
    return out;
}
export function defaultBootstrapPaths(rootDir = process.cwd()) {
    return [
        join(rootDir, "node_modules/@blockml/core/blocks"),
        join(rootDir, "node_modules/@machineblocks/core/blocks"),
    ];
}
export function bootstrapTypeRegistry(paths, rootDir = process.cwd()) {
    const registry = new TypeRegistry();
    const diagnostics = [];
    const resolvedPaths = paths.length > 0 ? paths : defaultBootstrapPaths(rootDir);
    const files = new Set();
    for (const base of resolvedPaths) {
        for (const file of collectBmlFiles(base)) {
            files.add(file);
        }
    }
    for (const filePath of files) {
        let source;
        try {
            source = readFileSync(filePath, "utf8");
        }
        catch (e) {
            diagnostics.push({
                severity: "warning",
                code: "BML_BOOTSTRAP_READ_ERROR",
                message: e instanceof Error ? e.message : String(e),
                source: { file: filePath, line: 1, column: 1 },
            });
            continue;
        }
        const result = parse(source, { filePath, continueOnError: true });
        for (const d of result.diagnostics) {
            diagnostics.push(d);
        }
        if (result.document?.block.type) {
            registry.register(result.document);
        }
    }
    return { registry, diagnostics };
}
//# sourceMappingURL=bootstrap.js.map