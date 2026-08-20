#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compileBmlToBom, compileToOutput, validateRegistryDocuments, } from "@blockml/compiler";
import { bootstrapTargets } from "./bootstrap-targets.js";
import { bootstrapProjectTypeRegistry } from "./bootstrap-type-registry.js";
import { loadConfig } from "./load-config.js";
import { writeOutputFiles } from "./write-output.js";
const USAGE = "Usage: blockml compile <blockdoc|xsd> [--out dir] [--src dir] [--libraries a,b]\n" +
    "       blockml validate [--all] [<file>] [--src dir] [--libraries a,b]";
const SUPPORTED_TARGETS = new Set(["blockdoc", "xsd"]);
export function parseArgs(argv) {
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
        else if (flag === "--all") {
            result.all = true;
        }
        else if (flag && !flag.startsWith("-")) {
            if (result.command === "validate") {
                if (!result.file) {
                    result.file = flag;
                }
            }
            else if (!result.target) {
                result.target = flag;
            }
        }
    }
    return result;
}
export function formatDiagnostic(d) {
    const loc = d.source ? `${d.source.file}:${d.source.line}` : "";
    return `${d.severity} ${d.code} ${loc} — ${d.message}`;
}
function printDiagnostics(diagnostics, lines) {
    for (const d of diagnostics) {
        lines.push(formatDiagnostic(d));
    }
}
function bootstrapOptsFromParsed(parsed, config, rootDir) {
    const bootstrapOpts = { config, rootDir };
    if (parsed.srcDir !== undefined) {
        bootstrapOpts.srcDirOverride = parsed.srcDir;
    }
    if (parsed.libraries !== undefined) {
        bootstrapOpts.librariesOverride = parsed.libraries;
    }
    return bootstrapOpts;
}
function runValidate(parsed, rootDir, lines) {
    if (parsed.file && parsed.all) {
        lines.push("Specify either <file> or --all, not both.");
        lines.push(USAGE);
        return 2;
    }
    let config;
    try {
        config = loadConfig(rootDir);
    }
    catch (e) {
        lines.push(e instanceof Error ? e.message : String(e));
        return 2;
    }
    const bootstrap = bootstrapProjectTypeRegistry(bootstrapOptsFromParsed(parsed, config, rootDir));
    if (parsed.file) {
        const filePath = resolve(rootDir, parsed.file);
        if (!existsSync(filePath)) {
            lines.push(`File not found: ${parsed.file}`);
            return 2;
        }
        const source = readFileSync(filePath, "utf8");
        const result = compileBmlToBom({ source, filePath }, { typeRegistry: bootstrap.registry, rootDir });
        printDiagnostics([...bootstrap.diagnostics, ...result.diagnostics], lines);
        return result.success ? 0 : 1;
    }
    const diagnostics = [
        ...bootstrap.diagnostics,
        ...validateRegistryDocuments(bootstrap.registry),
    ];
    printDiagnostics(diagnostics, lines);
    return diagnostics.some((d) => d.severity === "error") ? 1 : 0;
}
function defaultOutDir(target, config) {
    if (target === "xsd") {
        return "schemas";
    }
    return config.outDir ?? "doc";
}
function runCompile(parsed, rootDir, lines) {
    const target = parsed.target ?? "blockdoc";
    if (!SUPPORTED_TARGETS.has(target)) {
        lines.push(`Unsupported target in minimal CLI: ${target}`);
        return 2;
    }
    let config;
    try {
        config = loadConfig(rootDir);
    }
    catch (e) {
        lines.push(e instanceof Error ? e.message : String(e));
        return 2;
    }
    try {
        bootstrapTargets(config, [target]);
    }
    catch (e) {
        lines.push(e instanceof Error ? e.message : String(e));
        return 2;
    }
    const bootstrap = bootstrapProjectTypeRegistry(bootstrapOptsFromParsed(parsed, config, rootDir));
    const outDir = parsed.outDir ?? defaultOutDir(target, config);
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
        targetOptions: config.targetOptions?.[target],
    }, target, {
        typeRegistry: bootstrap.registry,
        outputBasePath: outDir,
        rootDir,
    }, configHints);
    printDiagnostics([...bootstrap.diagnostics, ...result.diagnostics], lines);
    if (!result.success || !result.output) {
        return 1;
    }
    writeOutputFiles(result.output, outDir, rootDir, { cleanOutDir: true });
    lines.push(`Wrote ${result.output.files.length} file(s) to ${outDir}/`);
    return 0;
}
export function runCli(argv, cwd = process.cwd()) {
    const parsed = parseArgs(argv);
    const lines = [];
    if (parsed.command === "validate") {
        const code = runValidate(parsed, cwd, lines);
        return { code, stderr: lines.length ? `${lines.join("\n")}\n` : "" };
    }
    if (parsed.command !== "compile") {
        lines.push(USAGE);
        return { code: 2, stderr: `${lines.join("\n")}\n` };
    }
    const code = runCompile(parsed, cwd, lines);
    return { code, stderr: lines.length ? `${lines.join("\n")}\n` : "" };
}
function isDirectRun() {
    const entry = process.argv[1];
    if (!entry) {
        return false;
    }
    try {
        return resolve(fileURLToPath(import.meta.url)) === resolve(entry);
    }
    catch {
        return false;
    }
}
if (isDirectRun()) {
    const { code, stderr } = runCli(process.argv.slice(2), process.cwd());
    if (stderr) {
        console.error(stderr.replace(/\n$/, ""));
    }
    process.exitCode = code;
}
//# sourceMappingURL=cli.js.map