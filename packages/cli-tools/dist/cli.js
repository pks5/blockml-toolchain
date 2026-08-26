#!/usr/bin/env node
import { bootstrapTypeRegistry, rootFqnByFilePath, } from "@blockml/framework";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compileBmlToBom, compileToOutput, getTarget, validateRegistryDocuments, } from "@blockml/compiler";
import { bootstrapTargets, getTargetCliHints, } from "./bootstrap-targets.js";
import { bootstrapProjectTypeRegistry, projectLibrarySeeds } from "./bootstrap-type-registry.js";
import { loadConfig } from "./load-config.js";
import { writeOutputFiles } from "./write-output.js";
const USAGE = "Usage: blockml compile <target> [--out dir] [--src dir] [--libraries a,b]\n" +
    "       blockml compile <file> <document-target> --src dir [--include a,b] [--out dir]\n" +
    "       blockml validate [--all] [<file>] [--src dir] [--libraries a,b] [--verbose]";
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
        else if (flag === "--verbose") {
            result.verbose = true;
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
function errorCount(diagnostics) {
    return diagnostics.filter((d) => d.severity === "error").length;
}
function printValidateOutcome(lines, blocksTested, blocksWithErrors, failed) {
    const word = blocksTested === 1 ? "block" : "blocks";
    const status = failed ? "failed" : "succeeded";
    lines.push(`Validation ${status}. Tested ${blocksTested} ${word}, ${blocksWithErrors} with errors.`);
}
function printNamedList(lines, title, items) {
    lines.push(`${title}:`);
    if (items.length === 0) {
        lines.push("  (none)");
        return;
    }
    for (const item of items) {
        lines.push(`  ${item}`);
    }
}
function printValidateSources(lines, srcDir, bootstrap) {
    const trace = bootstrap.trace;
    lines.push(`srcDir: ${srcDir}`);
    printNamedList(lines, "seeds", trace?.seeds ?? []);
    printNamedList(lines, "index (search only)", trace?.searchRoots ?? []);
    printNamedList(lines, "graph", trace?.librariesVisited ?? []);
    const files = [...rootFqnByFilePath(bootstrap.registry).keys()].sort();
    printNamedList(lines, `files (${files.length})`, files);
    if (trace?.skippedCoveredRoots.length) {
        printNamedList(lines, "skipped (covered by srcDir)", trace.skippedCoveredRoots);
    }
}
function printCompileSuccess(lines, wrote) {
    lines.push(`Compilation succeeded. ${wrote}`);
}
function printCompileFailure(lines, diagnostics, noOutput) {
    const errors = errorCount(diagnostics);
    if (noOutput && errors === 0) {
        lines.push("Compilation failed: no output files produced.");
        return;
    }
    lines.push(`Compilation failed with ${errors} error(s).`);
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
    const srcDir = parsed.srcDir ?? config.srcDir ?? "blocks";
    if (parsed.verbose) {
        printValidateSources(lines, resolve(rootDir, srcDir), bootstrap);
    }
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
        const failed = diagnostics.some((d) => d.severity === "error");
        printValidateOutcome(lines, 1, result.success ? 0 : 1, failed);
        return failed ? 1 : 0;
    }
    const validated = validateRegistryDocuments(bootstrap.registry);
    const diagnostics = [...bootstrap.diagnostics, ...validated.diagnostics];
    printDiagnostics(diagnostics, lines);
    const failed = diagnostics.some((d) => d.severity === "error");
    printValidateOutcome(lines, validated.blocksTested, validated.blocksWithErrors, failed);
    return failed ? 1 : 0;
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
    const diagnostics = [...bootstrap.diagnostics, ...result.diagnostics];
    printDiagnostics(diagnostics, lines);
    const output = result.output;
    const hasErrors = diagnostics.some((d) => d.severity === "error");
    if (!result.success || hasErrors || !output?.files.length) {
        printCompileFailure(lines, diagnostics, !output?.files.length && !hasErrors);
        return 1;
    }
    const writeResult = writeOutputFiles(output, outDir, rootDir, {
        cleanOutDir: false,
    });
    const rootNote = writeResult.rootFilesWritten.length > 0
        ? ` and ${writeResult.rootFilesWritten.join(", ")}`
        : "";
    const wrote = writeResult.filesWritten === 1 && output.files.length === 1
        ? `Wrote ${resolve(rootDir, outDir, output.files[0].path)}${rootNote}`
        : `Wrote ${writeResult.filesWritten} file(s) to ${outDir}/${rootNote}`;
    printCompileSuccess(lines, wrote);
    return 0;
}
async function runCompileCorpus(target, parsed, rootDir, config, lines) {
    const bootstrap = bootstrapProjectTypeRegistry(bootstrapOptsFromParsed(parsed, config, rootDir));
    const outDir = parsed.outDir ?? resolveDefaultOutDir(target, config);
    const srcDir = parsed.srcDir ?? config.srcDir ?? "blocks";
    const libraries = projectLibrarySeeds({
        config,
        rootDir,
        ...(parsed.libraries !== undefined ? { librariesOverride: parsed.libraries } : {}),
    });
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
    const diagnostics = [...bootstrap.diagnostics, ...result.diagnostics];
    printDiagnostics(diagnostics, lines);
    const output = result.output;
    const hasErrors = diagnostics.some((d) => d.severity === "error");
    const noOutput = !output || (output.files.length === 0 && !(output.rootFiles?.length));
    if (!result.success || hasErrors || !output || noOutput) {
        printCompileFailure(lines, diagnostics, noOutput && !hasErrors);
        return 1;
    }
    const writeResult = writeOutputFiles(output, outDir, rootDir, {
        cleanOutDir: true,
    });
    const rootNote = writeResult.rootFilesWritten.length > 0
        ? ` and ${writeResult.rootFilesWritten.join(", ")}`
        : "";
    printCompileSuccess(lines, `Wrote ${writeResult.filesWritten} file(s) to ${outDir}/${rootNote}`);
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
    try {
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
    catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return { code: 2, stderr: `Internal CLI error: ${message}\n` };
    }
}
/** True when argv[1] is this CLI module, including an npm `.bin` symlink to it. */
export function isCliEntry(argv1, modulePath) {
    if (!argv1) {
        return false;
    }
    try {
        return realpathSync(argv1) === realpathSync(modulePath);
    }
    catch {
        return resolve(argv1) === resolve(modulePath);
    }
}
if (isCliEntry(process.argv[1], fileURLToPath(import.meta.url))) {
    const { code, stderr } = await runCli(process.argv.slice(2), process.cwd());
    if (stderr) {
        console.error(stderr.replace(/\n$/, ""));
    }
    process.exitCode = code;
}
//# sourceMappingURL=cli.js.map