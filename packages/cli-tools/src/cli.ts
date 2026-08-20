#!/usr/bin/env node
import { bootstrapTypeRegistry } from "@blockml/framework";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  compileBmlToBom,
  compileToOutput,
  validateRegistryDocuments,
} from "@blockml/compiler";
import { bootstrapTargets } from "./bootstrap-targets.js";
import { bootstrapProjectTypeRegistry } from "./bootstrap-type-registry.js";
import { loadConfig, type BomConfig } from "./load-config.js";
import { writeOutputFiles, type WriteOutputOptions } from "./write-output.js";
import type { FatBlockRenderOutput } from "@blockml/fatblock-target";
import type { XsdRenderOutput } from "@blockml/xsd-target";

const USAGE =
  "Usage: blockml compile <blockdoc|xsd> [--out dir] [--src dir] [--libraries a,b]\n" +
  "       blockml compile <file> fatblock --src dir [--include a,b] [--out dir]\n" +
  "       blockml validate [--all] [<file>] [--src dir] [--libraries a,b]";

const SUPPORTED_TARGETS = new Set(["blockdoc", "xsd", "fatblock"]);
const DOCUMENT_TARGETS = new Set(["fatblock"]);

function workspaceRoot(from: string): string {
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

export interface ParsedArgs {
  command?: string;
  target?: string;
  file?: string;
  all?: boolean;
  outDir?: string;
  srcDir?: string;
  libraries?: string[];
  include?: string[];
}

interface PrintableDiagnostic {
  severity: string;
  code: string;
  message: string;
  source?: { file: string; line: number };
}

export function parseArgs(argv: string[]): ParsedArgs {
  const args = [...argv];
  const result: ParsedArgs = {};

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
    } else if (flag === "--src") {
      const value = args.shift();
      if (value) {
        result.srcDir = value;
      }
    } else if (flag === "--libraries") {
      const value = args.shift();
      if (value) {
        result.libraries = value.split(",").map((s) => s.trim()).filter(Boolean);
      }
    } else if (flag === "--include") {
      const value = args.shift();
      if (value) {
        result.include = value.split(",").map((s) => s.trim()).filter(Boolean);
      }
    } else if (flag === "--all") {
      result.all = true;
    } else if (flag && !flag.startsWith("-")) {
      if (result.command === "validate") {
        if (!result.file) {
          result.file = flag;
        }
      } else if (result.command === "compile") {
        if (flag.endsWith(".bml") && !result.file) {
          result.file = flag;
        } else if (!result.target) {
          result.target = flag;
        }
      } else if (!result.target) {
        result.target = flag;
      }
    }
  }

  return result;
}

export function formatDiagnostic(d: PrintableDiagnostic): string {
  const loc = d.source ? `${d.source.file}:${d.source.line}` : "";
  return `${d.severity} ${d.code} ${loc} — ${d.message}`;
}

function printDiagnostics(diagnostics: PrintableDiagnostic[], lines: string[]): void {
  for (const d of diagnostics) {
    lines.push(formatDiagnostic(d));
  }
}

function bootstrapOptsFromParsed(
  parsed: ParsedArgs,
  config: BomConfig,
  rootDir: string,
): {
  config: BomConfig;
  rootDir: string;
  srcDirOverride?: string;
  librariesOverride?: string[];
} {
  const bootstrapOpts: {
    config: BomConfig;
    rootDir: string;
    srcDirOverride?: string;
    librariesOverride?: string[];
  } = { config, rootDir };
  if (parsed.srcDir !== undefined) {
    bootstrapOpts.srcDirOverride = parsed.srcDir;
  }
  if (parsed.libraries !== undefined) {
    bootstrapOpts.librariesOverride = parsed.libraries;
  }
  return bootstrapOpts;
}

function runValidate(parsed: ParsedArgs, rootDir: string, lines: string[]): number {
  if (parsed.file && parsed.all) {
    lines.push("Specify either <file> or --all, not both.");
    lines.push(USAGE);
    return 2;
  }

  let config: BomConfig;
  try {
    config = loadConfig(rootDir);
  } catch (e) {
    lines.push(e instanceof Error ? e.message : String(e));
    return 2;
  }

  const bootstrap = bootstrapProjectTypeRegistry(
    bootstrapOptsFromParsed(parsed, config, rootDir),
  );

  if (parsed.file) {
    const filePath = resolve(rootDir, parsed.file);
    if (!existsSync(filePath)) {
      lines.push(`File not found: ${parsed.file}`);
      return 2;
    }
    const source = readFileSync(filePath, "utf8");
    const result = compileBmlToBom(
      { source, filePath },
      { typeRegistry: bootstrap.registry, rootDir },
    );
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

function defaultOutDir(target: string, config: BomConfig): string {
  if (target === "xsd") {
    return "schemas";
  }
  return config.outDir ?? "doc";
}

function runCompileFatBlock(
  parsed: ParsedArgs,
  rootDir: string,
  config: BomConfig,
  lines: string[],
): number {
  if (!parsed.file) {
    lines.push("FatBlock requires a host <file> argument.");
    lines.push(USAGE);
    return 2;
  }
  if (!parsed.srcDir) {
    lines.push("FatBlock requires --src <dir> for the embed candidate pool.");
    lines.push(USAGE);
    return 2;
  }

  const hostPath = resolve(rootDir, parsed.file);
  if (!existsSync(hostPath)) {
    lines.push(`File not found: ${parsed.file}`);
    return 2;
  }

  const srcDir = parsed.srcDir;
  const wsRoot = workspaceRoot(rootDir);
  const absSrc = resolve(rootDir, srcDir);
  const coreLibrary = join(
    wsRoot,
    "node_modules/@blockml/core/blocks/org/blockml/bml/Library.bml",
  );
  const bootstrap = bootstrapTypeRegistry({
    libraryPaths: existsSync(coreLibrary) ? [coreLibrary] : [],
    paths: [absSrc],
    rootDir: wsRoot,
  });
  const source = readFileSync(hostPath, "utf8");

  const fatblockConfig = config.targetOptions?.fatblock;
  const targetOptions = {
    srcDir: absSrc,
    rootDir: wsRoot,
    ...(parsed.include !== undefined ? { include: parsed.include } : {}),
    ...(typeof fatblockConfig === "object" && fatblockConfig !== null
      ? fatblockConfig
      : {}),
  };

  const result = compileToOutput(
    {
      scope: { kind: "document", document: { source, filePath: hostPath } },
      targetOptions,
    },
    "fatblock",
    {
      typeRegistry: bootstrap.registry,
      rootDir,
      outputBasePath: parsed.outDir ?? dirname(hostPath),
    },
  );

  const fatOutput = result.output as FatBlockRenderOutput | null;
  const fatDiagnostics = fatOutput?.diagnostics ?? [];
  printDiagnostics(
    [...bootstrap.diagnostics, ...result.diagnostics, ...fatDiagnostics],
    lines,
  );

  if (
    !result.success ||
    !fatOutput?.files.length ||
    fatDiagnostics.some((d: PrintableDiagnostic) => d.severity === "error")
  ) {
    return 1;
  }

  const outBase = parsed.outDir
    ? resolve(rootDir, parsed.outDir)
    : dirname(hostPath);
  const outFile = join(outBase, fatOutput.files[0]!.path);
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, fatOutput.files[0]!.content, "utf8");
  lines.push(`Wrote ${outFile}`);
  return 0;
}

function runCompile(parsed: ParsedArgs, rootDir: string, lines: string[]): number {
  const target = parsed.target ?? "blockdoc";
  if (!SUPPORTED_TARGETS.has(target)) {
    lines.push(`Unsupported target in minimal CLI: ${target}`);
    return 2;
  }

  let config: BomConfig;
  try {
    config = loadConfig(rootDir);
  } catch (e) {
    lines.push(e instanceof Error ? e.message : String(e));
    return 2;
  }

  try {
    bootstrapTargets(config, [target]);
  } catch (e) {
    lines.push(e instanceof Error ? e.message : String(e));
    return 2;
  }

  if (DOCUMENT_TARGETS.has(target)) {
    return runCompileFatBlock(parsed, rootDir, config, lines);
  }

  const bootstrap = bootstrapProjectTypeRegistry(
    bootstrapOptsFromParsed(parsed, config, rootDir),
  );

  const outDir = parsed.outDir ?? defaultOutDir(target, config);
  const srcDir = parsed.srcDir ?? config.srcDir ?? "src";
  const libraries = parsed.libraries ?? config.libraries ?? [];

  const scope: {
    kind: "auto";
    libraries?: string[];
    roots?: string[];
  } = { kind: "auto" };
  if (libraries.length > 0) {
    scope.libraries = libraries;
  } else {
    scope.roots = [srcDir];
  }

  const configHints: { libraries?: string[]; roots?: string[]; rootDir: string } = {
    rootDir,
  };
  if (libraries.length > 0) {
    configHints.libraries = libraries;
  } else {
    configHints.roots = [srcDir];
  }

  const result = compileToOutput(
    {
      scope,
      targetOptions: config.targetOptions?.[target],
    },
    target,
    {
      typeRegistry: bootstrap.registry,
      outputBasePath: outDir,
      rootDir,
    },
    configHints,
  );

  printDiagnostics([...bootstrap.diagnostics, ...result.diagnostics], lines);

  if (!result.success || !result.output) {
    return 1;
  }

  const writeOpts: WriteOutputOptions = { cleanOutDir: true };
  if (target === "xsd") {
    const xsdRootFiles = (result.output as XsdRenderOutput).rootFiles;
    if (xsdRootFiles) {
      writeOpts.rootFiles = xsdRootFiles;
    }
  }

  writeOutputFiles(result.output, outDir, rootDir, writeOpts);

  const rootNote =
    writeOpts.rootFiles && writeOpts.rootFiles.length > 0
      ? ` and ${writeOpts.rootFiles.map((f) => f.path).join(", ")}`
      : "";
  lines.push(`Wrote ${result.output.files.length} file(s) to ${outDir}/${rootNote}`);
  return 0;
}

export function runCli(argv: string[], cwd = process.cwd()): { code: number; stderr: string } {
  const parsed = parseArgs(argv);
  const lines: string[] = [];

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

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  try {
    return resolve(fileURLToPath(import.meta.url)) === resolve(entry);
  } catch {
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
