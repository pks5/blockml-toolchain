#!/usr/bin/env node
import { bootstrapTypeRegistry } from "@blockml/framework";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compileBmlToBom, compileToOutput, getTarget, validateRegistryDocuments, } from "@blockml/compiler";
import { bootstrapTargets, getTargetCliHints, } from "./bootstrap-targets.js";
import { bootstrapProjectTypeRegistry } from "./bootstrap-type-registry.js";
import { loadConfig } from "./load-config.js";
import { writeOutputFiles } from "./write-output.js";
const USAGE = "Usage: blockml compile <target> [--out dir] [--src dir] [--libraries a,b]\n" +
    "       blockml compile <file> <document-target> --src dir [--include a,b] [--out dir]\n" +
    "       blockml validate [--all] [<file>] [--src dir] [--libraries a,b]";
function workspaceRoot(from) {
    let dir = resolve(from);
    for (;;) {
        if (existsSync(join(dir, "node_modules/@blockml/core"))) {
            return dir;
        }
        const parent = dirname(dir);
        if (parent === dir) {
            return from;
        }
        dir = parent;
    }
}
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
        else if (flag === "--include") {
            const value = args.shift();
            if (value) {
                result.include = value.split(",").map((s) => s.trim()).filter(Boolean);
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
            else if (result.command === "compile") {
                if (flag.endsWith(".bml") && !result.file) {
                    result.file = flag;
                }
                else if (!result.target) {
                    result.target = flag;
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
function isDocumentOnlyTarget(target) {
    return (target.accepts.includes("document") &&
        !target.accepts.some((kind) => kind === "library" || kind === "corpus" || kind === "auto"));
}
function resolveDefaultOutDir(target, config) {
    const hints = getTargetCliHints(target);
    if (hints?.defaultOutDir) {
        if (typeof hints.defaultOutDir === "function") {
            return hints.defaultOutDir(config);
        }
        return hints.defaultOutDir;
    }
    return config.outDir ?? "doc";
}
function resolveDocumentOutDir(parsed, config, rootDir, hostPath) {
    if (parsed.outDir) {
        return parsed.outDir;
    }
    const hostDir = dirname(hostPath);
    const rel = relative(rootDir, hostDir);
    return rel || ".";
}
function buildDocumentTargetOptions(target, parsed, config, wsRoot, absSrc) {
    const fromConfig = config.targetOptions?.[target];
    const base = typeof fromConfig === "object" && fromConfig !== null
        ? { ...fromConfig }
        : {};
    if (absSrc) {
        base.srcDir = absSrc;
        base.rootDir = wsRoot;
    }
    if (parsed.include !== undefined) {
        base.include = parsed.include;
    }
    return base;
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
        const diagnostics = [...bootstrap.diagnostics, ...result.diagnostics];
        printDiagnostics(diagnostics, lines);
        return diagnostics.some((d) => d.severity === "error") ? 1 : 0;
    }
    const diagnostics = [
        ...bootstrap.diagnostics,
        ...validateRegistryDocuments(bootstrap.registry),
    ];
    printDiagnostics(diagnostics, lines);
    return diagnostics.some((d) => d.severity === "error") ? 1 : 0;
}
async function runCompileDocument(target, parsed, rootDir, config, lines) {
    const hints = getTargetCliHints(target);
    if (hints?.requiresHostFile && !parsed.file) {
        lines.push(`${target} requires a host <file> argument.`);
        lines.push(USAGE);
        return 2;
    }
    if (hints?.requiresSrcDir && !parsed.srcDir) {
        lines.push(`${target} requires --src <dir> for the embed candidate pool.`);
        lines.push(USAGE);
        return 2;
    }
    const hostPath = resolve(rootDir, parsed.file);
    if (!existsSync(hostPath)) {
        lines.push(`File not found: ${parsed.file}`);
        return 2;
    }
    const wsRoot = workspaceRoot(rootDir);
    const absSrc = parsed.srcDir ? resolve(rootDir, parsed.srcDir) : undefined;
    let bootstrap;
    if (hints?.documentBootstrap === "workspace-core") {
        const coreLibrary = join(wsRoot, "node_modules/@blockml/core/blocks/org/blockml/bml/Library.bml");
        bootstrap = bootstrapTypeRegistry({
            libraryPaths: existsSync(coreLibrary) ? [coreLibrary] : [],
            paths: absSrc ? [absSrc] : [dirname(hostPath)],
            rootDir: wsRoot,
        });
    }
    else {
        const bootstrapOpts = { config, rootDir };
        if (parsed.srcDir !== undefined) {
            bootstrapOpts.srcDirOverride = parsed.srcDir;
        }
        if (parsed.libraries !== undefined) {
            bootstrapOpts.librariesOverride = parsed.libraries;
        }
        bootstrap = bootstrapProjectTypeRegistry(bootstrapOpts);
    }
    const source = readFileSync(hostPath, "utf8");
    const outDir = resolveDocumentOutDir(parsed, config, rootDir, hostPath);
    const targetOptions = buildDocumentTargetOptions(target, parsed, config, wsRoot, absSrc);
    const result = compileToOutput({
        scope: { kind: "document", document: { source, filePath: hostPath } },
        targetOptions,
    }, target, {
        typeRegistry: bootstrap.registry,
        rootDir,
        outputBasePath: outDir,
    });
    const outputDiagnostics = result.output?.diagnostics ?? [];
    printDiagnostics([...bootstrap.diagnostics, ...result.diagnostics, ...outputDiagnostics], lines);
    if (!result.success ||
        !result.output?.files.length ||
        outputDiagnostics.some((d) => d.severity === "error")) {
        return 1;
    }
    const writeResult = writeOutputFiles(result.output, outDir, rootDir, {
        cleanOutDir: false,
    });
    const rootNote = writeResult.rootFilesWritten.length > 0
        ? ` and ${writeResult.rootFilesWritten.join(", ")}`
        : "";
    if (writeResult.filesWritten === 1 && result.output.files.length === 1) {
        lines.push(`Wrote ${resolve(rootDir, outDir, result.output.files[0].path)}${rootNote}`);
    }
    else {
        lines.push(`Wrote ${writeResult.filesWritten} file(s) to ${outDir}/${rootNote}`);
    }
    return 0;
}
async function runCompileCorpus(target, parsed, rootDir, config, lines) {
    const bootstrap = bootstrapProjectTypeRegistry(bootstrapOptsFromParsed(parsed, config, rootDir));
    const outDir = parsed.outDir ?? resolveDefaultOutDir(target, config);
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
    const outputDiagnostics = result.output?.diagnostics ?? [];
    printDiagnostics([...bootstrap.diagnostics, ...result.diagnostics, ...outputDiagnostics], lines);
    if (!result.success ||
        !result.output ||
        outputDiagnostics.some((d) => d.severity === "error")) {
        return 1;
    }
    const writeResult = writeOutputFiles(result.output, outDir, rootDir, {
        cleanOutDir: true,
    });
    const rootNote = writeResult.rootFilesWritten.length > 0
        ? ` and ${writeResult.rootFilesWritten.join(", ")}`
        : "";
    lines.push(`Wrote ${writeResult.filesWritten} file(s) to ${outDir}/${rootNote}`);
    return 0;
}
async function runCompile(parsed, rootDir, lines) {
    let config;
    try {
        config = loadConfig(rootDir);
    }
    catch (e) {
        lines.push(e instanceof Error ? e.message : String(e));
        return 2;
    }
    const target = parsed.target ?? config.defaultTarget ?? "blockdoc";
    try {
        await bootstrapTargets(config, [target], rootDir);
    }
    catch (e) {
        lines.push(e instanceof Error ? e.message : String(e));
        return 2;
    }
    const registered = getTarget(target);
    if (!registered) {
        lines.push(`Unknown target: ${target}`);
        return 2;
    }
    if (isDocumentOnlyTarget(registered)) {
        return runCompileDocument(target, parsed, rootDir, config, lines);
    }
    return runCompileCorpus(target, parsed, rootDir, config, lines);
}
export async function runCli(argv, cwd = process.cwd()) {
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
    const code = await runCompile(parsed, cwd, lines);
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
    const { code, stderr } = await runCli(process.argv.slice(2), process.cwd());
    if (stderr) {
        console.error(stderr.replace(/\n$/, ""));
    }
    process.exitCode = code;
}
//# sourceMappingURL=cli.js.map