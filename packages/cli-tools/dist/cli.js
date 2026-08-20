#!/usr/bin/env node
import { compileToOutput } from "@blockml/compiler";
import { bootstrapTargets } from "./bootstrap-targets.js";
import { bootstrapProjectTypeRegistry } from "./bootstrap-type-registry.js";
import { loadConfig } from "./load-config.js";
import { writeOutputFiles } from "./write-output.js";
function parseArgs(argv) {
    const args = [...argv];
    const result = {};
    const first = args.shift();
    if (first !== undefined && !first.startsWith("-")) {
        result.command = first;
    }
    while (args.length > 0) {
        const flag = args.shift();
        if (flag === "--out") {
            const value = args.shift();
            if (value) {
                result.outDir = value;
            }
        }
        else if (flag === "--src") {
            const value = args.shift();
            if (value) {
                result.srcDir = value;
            }
        }
        else if (flag === "--libraries") {
            const value = args.shift();
            if (value) {
                result.libraries = value.split(",").map((s) => s.trim()).filter(Boolean);
            }
        }
        else if (flag && !flag.startsWith("-") && !result.target) {
            result.target = flag;
        }
    }
    return result;
}
async function main() {
    const parsed = parseArgs(process.argv.slice(2));
    const rootDir = process.cwd();
    if (parsed.command !== "compile") {
        console.error("Usage: blockml compile blockdoc [--out dir] [--src dir] [--libraries a,b]");
        return 2;
    }
    const target = parsed.target ?? "blockdoc";
    if (target !== "blockdoc") {
        console.error(`Unsupported target in minimal CLI: ${target}`);
        return 2;
    }
    let config;
    try {
        config = loadConfig(rootDir);
    }
    catch (e) {
        console.error(e instanceof Error ? e.message : String(e));
        return 2;
    }
    try {
        bootstrapTargets(config);
    }
    catch (e) {
        console.error(e instanceof Error ? e.message : String(e));
        return 2;
    }
    const bootstrapOpts = { config, rootDir };
    if (parsed.srcDir !== undefined) {
        bootstrapOpts.srcDirOverride = parsed.srcDir;
    }
    if (parsed.libraries !== undefined) {
        bootstrapOpts.librariesOverride = parsed.libraries;
    }
    const bootstrap = bootstrapProjectTypeRegistry(bootstrapOpts);
    const outDir = parsed.outDir ?? config.outDir ?? "doc";
    const srcDir = parsed.srcDir ?? config.srcDir ?? "src";
    const libraries = parsed.libraries ?? config.libraries ?? [];
    const scope = { kind: "auto" };
    if (libraries.length > 0) {
        scope.libraries = libraries;
    }
    else {
        scope.roots = [srcDir];
    }
    const configHints = {
        rootDir,
    };
    if (libraries.length > 0) {
        configHints.libraries = libraries;
    }
    else {
        configHints.roots = [srcDir];
    }
    const result = compileToOutput({
        scope,
        targetOptions: config.targetOptions?.blockdoc,
    }, target, {
        typeRegistry: bootstrap.registry,
        outputBasePath: outDir,
        rootDir,
    }, configHints);
    for (const d of [...bootstrap.diagnostics, ...result.diagnostics]) {
        const loc = d.source ? `${d.source.file}:${d.source.line}` : "";
        console.error(`${d.severity} ${d.code} ${loc} — ${d.message}`);
    }
    if (!result.success || !result.output) {
        return 1;
    }
    writeOutputFiles(result.output, outDir, rootDir);
    console.error(`Wrote ${result.output.files.length} file(s) to ${outDir}/`);
    return 0;
}
main()
    .then((code) => {
    process.exitCode = code;
})
    .catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
//# sourceMappingURL=cli.js.map