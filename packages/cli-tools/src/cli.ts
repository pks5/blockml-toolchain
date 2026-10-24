#!/usr/bin/env node
import {
  bootstrapFullProjectRegistry,
  rootFqnByFilePath,
  type BootstrapResult,
} from "@blockml/framework";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  compileBmlToBom,
  compileToOutput,
  getTarget,
  validateRegistryDocuments,
  type CompileScopeKind,
  type RenderTarget,
} from "@blockml/compiler";
import {
  bootstrapTargets,
  getTargetCliHints,
} from "./bootstrap-targets.js";
import {
  bootstrapProjectTypeRegistry,
  projectIdentityLibraryPath,
  projectLibrarySeeds,
  shouldSeedWorkspaceCore,
  workspaceCoreLibraryPath,
} from "./bootstrap-type-registry.js";
import {
  diagnosticKind,
  formatCliOutput,
  pushLines,
  writeCliOutput,
  type CliOutputLine,
} from "./cli-style.js";
import { loadConfig, type BomConfig } from "./load-config.js";
import { projectLibraryPackageDirs, projectLibraryPackageRoots, projectSourceRoots, registryFilesUnderRoots } from "./project-sources.js";
import { runSearch } from "./run-search.js";
import { runScan } from "./run-scan.js";
import { runGraph } from "./run-graph.js";
import { runInspect } from "./run-inspect.js";
import { runNew } from "./run-new.js";
import { initProject } from "./run-init.js";
import { generateAgentsMd } from "./run-agents-md.js";
import { defaultTransformAgent, runTransform } from "./run-transform.js";
import { writeOutputFiles } from "./write-output.js";
import type { ReflectionAgent, TransformationAgent } from "@blockml/transformer";
import {
  AGENTS_MD_USAGE,
  GRAPH_USAGE,
  INSPECT_USAGE,
  SCAN_USAGE,
  SEARCH_USAGE,
  USAGE,
  helpFor,
} from "./help.js";

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
  subcommand?: string;
  target?: string;
  file?: string;
  all?: boolean;
  outDir?: string;
  srcDir?: string;
  libraries?: string[];
  library?: string;
  include?: string[];
  verbose?: boolean;
  perPackage?: boolean;
  json?: boolean;
  force?: boolean;
  limit?: number;
  query?: string;
  index?: boolean;
  graphFqn?: string;
  graphTo?: string;
  inspectFqn?: string;
  depth?: number;
  executionFqn?: string;
  parametersJson?: string;
  parameterMappingsJson?: string;
  newFqn?: string;
  newBaseType?: string;
  newIs?: string;
  initFqn?: string;
  noInstall?: boolean;
  selectors?: string[];
  help?: boolean;
  origin?: string;
  relation?: string;
}

export interface CliRunOptions {
  transformAgent?: TransformationAgent;
  reflectAgent?: ReflectionAgent;
  onOutputLine?: (line: CliOutputLine) => void;
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

  const first = args[0];
  if (first !== undefined && !first.startsWith("-")) {
    result.command = first;
    args.shift();
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
    } else if (flag === "--library") {
      const value = args.shift();
      if (value) {
        result.library = value;
      }
    } else if (flag === "--include") {
      const value = args.shift();
      if (value) {
        result.include = value.split(",").map((s) => s.trim()).filter(Boolean);
      }
    } else if (flag === "--all") {
      result.all = true;
    } else if (flag === "--per-package") {
      result.perPackage = true;
    } else if (flag === "--verbose") {
      result.verbose = true;
    } else if (flag === "--json") {
      result.json = true;
    } else if (flag === "--force") {
      result.force = true;
    } else if (flag === "--limit") {
      const value = args.shift();
      if (value) {
        const n = Number(value);
        if (Number.isFinite(n) && n > 0) {
          result.limit = Math.floor(n);
        }
      }
    } else if (flag === "--depth") {
      const value = args.shift();
      if (value) {
        const n = Number(value);
        if (Number.isFinite(n) && n >= 0) {
          result.depth = Math.floor(n);
        }
      }
    } else if (flag === "--parameters") {
      const value = args.shift();
      result.parametersJson = value ?? "";
    } else if (flag === "--parameter-mappings") {
      const value = args.shift();
      result.parameterMappingsJson = value ?? "";
    } else if (flag === "--baseType") {
      const value = args.shift();
      if (value) {
        result.newBaseType = value;
      }
    } else if (flag === "--is") {
      const value = args.shift();
      if (value) {
        result.newIs = value;
      }
    } else if (flag === "--no-install") {
      result.noInstall = true;
    } else if (flag === "--help" || flag === "-h") {
      result.help = true;
    } else if (flag === "--origin") {
      const value = args.shift();
      if (value) {
        result.origin = value;
      }
    } else if (flag === "--relation") {
      const value = args.shift();
      if (value) {
        result.relation = value;
      }
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
      } else if (result.command === "search") {
        if (flag === "index" && result.query === undefined && result.index !== true) {
          result.index = true;
        } else if (result.index) {
          result.index = false;
          result.query = result.query ? `${result.query} ${flag}` : `index ${flag}`;
        } else {
          result.query = result.query ? `${result.query} ${flag}` : flag;
        }
      } else if (result.command === "graph") {
        if (!result.subcommand) {
          result.subcommand = flag;
        } else if (result.subcommand === "path") {
          if (!result.graphFqn) {
            result.graphFqn = flag;
          } else if (!result.graphTo) {
            result.graphTo = flag;
          }
        } else if (result.subcommand === "query") {
          result.query = result.query ? `${result.query} ${flag}` : flag;
        } else if (
          result.subcommand === "neighbors" ||
          result.subcommand === "uses" ||
          result.subcommand === "used-by" ||
          result.subcommand === "ancestors" ||
          result.subcommand === "descendants" ||
          result.subcommand === "members"
        ) {
          if (!result.graphFqn) {
            result.graphFqn = flag;
          }
        }
      } else if (result.command === "transform") {
        if (!result.subcommand) {
          result.subcommand = flag;
        } else if (result.subcommand === "apply" && !result.executionFqn) {
          result.executionFqn = flag;
        }
      } else if (result.command === "scan") {
        if (!result.subcommand) {
          result.subcommand = flag;
        } else {
          result.selectors = result.selectors ? [...result.selectors, flag] : [flag];
        }
      } else if (result.command === "inspect") {
        if (!result.inspectFqn) {
          result.inspectFqn = flag;
        }
      } else if (result.command === "new") {
        if (!result.newFqn) {
          result.newFqn = flag;
        }
      } else if (result.command === "init") {
        if (!result.initFqn) {
          result.initFqn = flag;
        }
      } else if (result.command === "agents-md") {
        if (!result.subcommand) {
          result.subcommand = flag;
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

function printDiagnostics(
  diagnostics: PrintableDiagnostic[],
  lines: CliOutputLine[],
): void {
  for (const d of diagnostics) {
    pushLines(lines, formatDiagnostic(d), diagnosticKind(d.severity));
  }
}

function errorCount(diagnostics: PrintableDiagnostic[]): number {
  return diagnostics.filter((d) => d.severity === "error").length;
}

function countBySeverity(
  diagnostics: PrintableDiagnostic[],
  severity: PrintableDiagnostic["severity"],
): number {
  return diagnostics.filter((d) => d.severity === severity).length;
}

/** Unique files with error diagnostics (parse + semantic). Unlocated errors count as one block. */
function countBlocksWithErrors(diagnostics: PrintableDiagnostic[]): number {
  const files = new Set<string>();
  let unlocated = 0;
  for (const d of diagnostics) {
    if (d.severity !== "error") {
      continue;
    }
    const file = d.source?.file;
    if (file) {
      files.add(file);
    } else {
      unlocated += 1;
    }
  }
  if (files.size > 0) {
    return files.size;
  }
  return unlocated > 0 ? 1 : 0;
}

function printValidateOutcome(
  lines: CliOutputLine[],
  blocksTested: number,
  failed: boolean,
  diagnostics: PrintableDiagnostic[],
): void {
  const word = blocksTested === 1 ? "block" : "blocks";
  const status = failed ? "failed" : "succeeded";
  const blocksWithErrors = countBlocksWithErrors(diagnostics);
  const warnings = countBySeverity(diagnostics, "warning");
  const recommendations = countBySeverity(diagnostics, "recommendation");
  const warningWord = warnings === 1 ? "warning" : "warnings";
  const recWord = recommendations === 1 ? "recommendation" : "recommendations";
  pushLines(
    lines,
    `Validation ${status}. Tested ${blocksTested} ${word}, ${blocksWithErrors} with errors, ${warnings} ${warningWord}, ${recommendations} ${recWord}.`,
    failed ? "error" : "success",
  );
}

function printNamedList(lines: CliOutputLine[], title: string, items: string[]): void {
  pushLines(lines, `${title}:`, "info");
  if (items.length === 0) {
    pushLines(lines, "  (none)", "info");
    return;
  }
  for (const item of items) {
    pushLines(lines, `  ${item}`, "info");
  }
}

function printValidateSources(
  lines: CliOutputLine[],
  srcDir: string,
  bootstrap: BootstrapResult,
  validateFiles: string[],
): void {
  const trace = bootstrap.trace;
  const registryFiles = [...rootFqnByFilePath(bootstrap.registry).keys()].sort();
  pushLines(lines, `srcDir: ${srcDir}`, "info");
  printNamedList(lines, "seeds", trace?.seeds ?? []);
  printNamedList(lines, "index (search only)", trace?.searchRoots ?? []);
  printNamedList(lines, "graph", trace?.librariesVisited ?? []);
  printNamedList(lines, `validate (${validateFiles.length})`, validateFiles);
  printNamedList(lines, `registry (${registryFiles.length})`, registryFiles);
  if (trace?.skippedCoveredRoots.length) {
    printNamedList(lines, "skipped (covered by srcDir)", trace.skippedCoveredRoots);
  }
}

function printCompileSuccess(lines: CliOutputLine[], wrote: string): void {
  pushLines(lines, `Compilation succeeded. ${wrote}`, "success");
}

function printCompileFailure(
  lines: CliOutputLine[],
  diagnostics: PrintableDiagnostic[],
  noOutput: boolean,
): void {
  const errors = errorCount(diagnostics);
  if (noOutput && errors === 0) {
    pushLines(lines, "Compilation failed: no output files produced.", "error");
    return;
  }
  pushLines(lines, `Compilation failed with ${errors} error(s).`, "error");
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

function isDocumentOnlyTarget(target: RenderTarget): boolean {
  return (
    target.accepts.includes("document") &&
    !target.accepts.some((kind: CompileScopeKind) =>
      kind === "library" || kind === "corpus" || kind === "auto",
    )
  );
}

function resolveDefaultOutDir(target: string, config: BomConfig): string {
  const hints = getTargetCliHints(target);
  if (hints?.defaultOutDir) {
    if (typeof hints.defaultOutDir === "function") {
      return hints.defaultOutDir(config);
    }
    return hints.defaultOutDir;
  }
  return config.outDir ?? "blockdoc";
}

function resolveDocumentOutDir(
  target: string,
  parsed: ParsedArgs,
  config: BomConfig,
  rootDir: string,
  hostPath: string,
): string {
  if (parsed.outDir) {
    return parsed.outDir;
  }
  const hints = getTargetCliHints(target);
  if (hints?.defaultOutDir) {
    if (typeof hints.defaultOutDir === "function") {
      return hints.defaultOutDir(config);
    }
    return hints.defaultOutDir;
  }
  const hostDir = dirname(hostPath);
  const rel = relative(rootDir, hostDir);
  return rel || ".";
}

function applyDocumentTargetDefaults(
  target: string,
  parsed: ParsedArgs,
  rootDir: string,
): void {
  const hints = getTargetCliHints(target);
  if (!parsed.file && hints?.defaultHostFromPackageLibrary) {
    const identity = projectIdentityLibraryPath(rootDir);
    if (identity) {
      parsed.file = identity;
    }
  }
  if (!parsed.srcDir && parsed.file && hints?.defaultSrcFromHostDir) {
    const hostPath = resolve(rootDir, parsed.file);
    const rel = relative(rootDir, dirname(hostPath));
    parsed.srcDir = rel === "" ? "." : rel;
  }
}

function bootstrapDocumentTypeRegistry(
  documentBootstrap: "project" | "workspace-core" | undefined,
  parsed: ParsedArgs,
  config: BomConfig,
  rootDir: string,
  wsRoot: string,
): BootstrapResult {
  if (documentBootstrap === "workspace-core") {
    const extras = [
      ...(parsed.libraries !== undefined
        ? parsed.libraries
        : (config.libraries ?? [])),
    ];
    const coreLibrary = workspaceCoreLibraryPath(wsRoot);
    if (
      coreLibrary &&
      shouldSeedWorkspaceCore(projectIdentityLibraryPath(rootDir), coreLibrary)
    ) {
      extras.push(coreLibrary);
    }
    const bootstrapOpts: {
      config: BomConfig;
      rootDir: string;
      srcDirOverride?: string;
      librariesOverride: string[];
    } = { config, rootDir, librariesOverride: extras };
    if (parsed.srcDir !== undefined) {
      bootstrapOpts.srcDirOverride = parsed.srcDir;
    }
    return bootstrapProjectTypeRegistry(bootstrapOpts);
  }

  return bootstrapProjectTypeRegistry(
    bootstrapOptsFromParsed(parsed, config, rootDir),
  );
}

function buildDocumentTargetOptions(
  target: string,
  parsed: ParsedArgs,
  config: BomConfig,
  wsRoot: string,
  absSrc?: string,
): Record<string, unknown> {
  const fromConfig = config.targetOptions?.[target];
  const base =
    typeof fromConfig === "object" && fromConfig !== null
      ? { ...(fromConfig as Record<string, unknown>) }
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

function runValidate(parsed: ParsedArgs, rootDir: string, lines: CliOutputLine[]): number {
  if (parsed.file && parsed.all) {
    pushLines(lines, "Specify either <file> or --all, not both.", "error");
    pushLines(lines, USAGE, "info");
    return 2;
  }

  let config: BomConfig;
  try {
    config = loadConfig(rootDir);
  } catch (e) {
    pushLines(lines, e instanceof Error ? e.message : String(e), "error");
    return 2;
  }

  const srcDir = parsed.srcDir ?? config.srcDir ?? "blocks";
  const projectRoots = projectSourceRoots(rootDir, srcDir);
  const bootstrap = bootstrapFullProjectRegistry({
    rootDir,
    srcDir,
    libraries: parsed.libraries ?? config.libraries ?? [],
  });

  const registryFiles = [...rootFqnByFilePath(bootstrap.registry).keys()].sort();
  let validateFiles: string[];
  if (parsed.file) {
    validateFiles = [resolve(rootDir, parsed.file)];
  } else if (parsed.all) {
    validateFiles = registryFiles;
  } else {
    validateFiles = registryFilesUnderRoots(bootstrap.registry, projectRoots);
  }

  if (parsed.verbose) {
    printValidateSources(lines, resolve(rootDir, srcDir), bootstrap, validateFiles);
  }

  if (parsed.file) {
    const filePath = resolve(rootDir, parsed.file);
    if (!existsSync(filePath)) {
      pushLines(lines, `File not found: ${parsed.file}`, "error");
      return 2;
    }
    const source = readFileSync(filePath, "utf8");
    const result = compileBmlToBom(
      { source, filePath },
      { typeRegistry: bootstrap.registry, rootDir },
    );
    const diagnostics = [...bootstrap.diagnostics, ...result.diagnostics];
    printDiagnostics(diagnostics, lines);
    const failed = diagnostics.some((d) => d.severity === "error");
    printValidateOutcome(lines, 1, failed, diagnostics);
    return failed ? 1 : 0;
  }

  const validated = parsed.all
    ? validateRegistryDocuments(bootstrap.registry)
    : validateRegistryDocuments(bootstrap.registry, validateFiles);
  const diagnostics = [...bootstrap.diagnostics, ...validated.diagnostics];
  printDiagnostics(diagnostics, lines);
  const failed = diagnostics.some((d) => d.severity === "error");
  printValidateOutcome(lines, validated.blocksTested, failed, diagnostics);
  return failed ? 1 : 0;
}

function perPackageOutDir(
  parsed: ParsedArgs,
  invocationRoot: string,
): string {
  if (parsed.outDir) {
    return resolve(invocationRoot, parsed.outDir);
  }
  return resolve(invocationRoot);
}

async function compileDocumentOnce(
  target: string,
  parsed: ParsedArgs,
  rootDir: string,
  config: BomConfig,
  lines: CliOutputLine[],
): Promise<{ code: number; wrote?: string }> {
  applyDocumentTargetDefaults(target, parsed, rootDir);
  const hints = getTargetCliHints(target);
  if (hints?.requiresHostFile && !parsed.file) {
    pushLines(
      lines,
      hints.defaultHostFromPackageLibrary
        ? `${target} requires a host <file> argument or package.json blockml.library.`
        : `${target} requires a host <file> argument.`,
      "error",
    );
    pushLines(lines, USAGE, "info");
    return { code: 2 };
  }
  if (hints?.requiresSrcDir && !parsed.srcDir) {
    pushLines(lines, `${target} requires --src <dir> for the embed candidate pool.`, "error");
    pushLines(lines, USAGE, "info");
    return { code: 2 };
  }

  const hostPath = resolve(rootDir, parsed.file!);
  if (!existsSync(hostPath)) {
    pushLines(lines, `File not found: ${parsed.file}`, "error");
    return { code: 2 };
  }

  const wsRoot = workspaceRoot(rootDir);
  const absSrc = parsed.srcDir ? resolve(rootDir, parsed.srcDir) : undefined;
  const bootstrap = bootstrapDocumentTypeRegistry(
    hints?.documentBootstrap,
    parsed,
    config,
    rootDir,
    wsRoot,
  );

  const source = readFileSync(hostPath, "utf8");
  const outDir = resolveDocumentOutDir(target, parsed, config, rootDir, hostPath);
  const targetOptions = buildDocumentTargetOptions(
    target,
    parsed,
    config,
    wsRoot,
    absSrc,
  );

  const result = compileToOutput(
    {
      scope: { kind: "document", document: { source, filePath: hostPath } },
      targetOptions,
    },
    target,
    {
      typeRegistry: bootstrap.registry,
      rootDir,
      outputBasePath: outDir,
    },
  );

  const diagnostics = [...bootstrap.diagnostics, ...result.diagnostics];
  printDiagnostics(diagnostics, lines);

  const output = result.output;
  const hasErrors = diagnostics.some((d) => d.severity === "error");
  if (!result.success || hasErrors || !output?.files.length) {
    printCompileFailure(lines, diagnostics, !output?.files.length && !hasErrors);
    return { code: 1 };
  }

  writeOutputFiles(output, outDir, rootDir, {
    cleanOutDir: false,
  });
  const wrote = resolve(rootDir, outDir, output.files[0]!.path);
  return { code: 0, wrote };
}

async function runCompileDocument(
  target: string,
  parsed: ParsedArgs,
  rootDir: string,
  config: BomConfig,
  lines: CliOutputLine[],
): Promise<number> {
  const result = await compileDocumentOnce(target, parsed, rootDir, config, lines);
  if (result.code === 0 && result.wrote) {
    printCompileSuccess(lines, `Wrote ${result.wrote}`);
  }
  return result.code;
}

async function runCompilePerPackage(
  target: string,
  parsed: ParsedArgs,
  rootDir: string,
  lines: CliOutputLine[],
): Promise<number> {
  if (parsed.file) {
    pushLines(lines, "--per-package cannot be combined with a host <file> argument.", "error");
    pushLines(lines, USAGE, "info");
    return 2;
  }
  if (parsed.srcDir) {
    pushLines(lines, "--per-package cannot be combined with --src.", "error");
    pushLines(lines, USAGE, "info");
    return 2;
  }

  const packageDirs = projectLibraryPackageDirs(rootDir);
  if (packageDirs.length === 0) {
    pushLines(lines, "No packages with package.json blockml.library found.", "error");
    return 2;
  }

  const wrote: string[] = [];
  let worst = 0;
  for (const pkgDir of packageDirs) {
    const pkgParsed: ParsedArgs = { ...parsed };
    delete pkgParsed.perPackage;
    delete pkgParsed.file;
    delete pkgParsed.srcDir;
    pkgParsed.outDir = perPackageOutDir(parsed, rootDir);
    let pkgConfig: BomConfig;
    try {
      pkgConfig = loadConfig(pkgDir);
    } catch (e) {
      pushLines(lines, e instanceof Error ? e.message : String(e), "error");
      worst = 2;
      continue;
    }
    const label = relative(rootDir, pkgDir) || ".";
    const pkgLines: CliOutputLine[] = [];
    const result = await compileDocumentOnce(
      target,
      pkgParsed,
      pkgDir,
      pkgConfig,
      pkgLines,
    );
    if (pkgLines.length > 0) {
      pushLines(lines, `${target} ${label}:`, "info");
      lines.push(...pkgLines);
    }
    if (result.wrote) {
      wrote.push(result.wrote);
    }
    if (result.code > worst) {
      worst = result.code;
    }
  }

  if (worst === 0) {
    if (wrote.length === 0) {
      printCompileFailure(lines, [], true);
      return 1;
    }
    const summary =
      wrote.length === 1
        ? `Wrote ${wrote[0]}`
        : `Wrote ${wrote.length} file(s):\n${wrote.map((p) => `  ${p}`).join("\n")}`;
    printCompileSuccess(lines, summary);
    return 0;
  }
  if (wrote.length > 0) {
    pushLines(lines, `Wrote ${wrote.length} file(s) before failure.`, "info");
  }
  return worst;
}

function isBlockdocProjectLibraryScan(
  target: string,
  parsed: ParsedArgs,
  config: BomConfig,
): boolean {
  return (
    target === "blockdoc" &&
    parsed.srcDir === undefined &&
    parsed.libraries === undefined &&
    !(config.libraries && config.libraries.length > 0)
  );
}

async function runCompileCorpus(
  target: string,
  parsed: ParsedArgs,
  rootDir: string,
  config: BomConfig,
  lines: CliOutputLine[],
): Promise<number> {
  const srcDir = parsed.srcDir ?? config.srcDir ?? "blocks";
  const libraries = projectLibrarySeeds({
    config,
    rootDir,
    ...(parsed.libraries !== undefined ? { librariesOverride: parsed.libraries } : {}),
  });
  const projectRoots = isBlockdocProjectLibraryScan(target, parsed, config)
    ? projectLibraryPackageRoots(rootDir)
    : undefined;

  const bootstrap = bootstrapProjectTypeRegistry({
    ...bootstrapOptsFromParsed(parsed, config, rootDir),
    ...(projectRoots && projectRoots.length > 0 ? { corpusPaths: projectRoots } : {}),
  });

  const outDir = parsed.outDir ?? resolveDefaultOutDir(target, config);

  const scope: {
    kind: "auto";
    libraries?: string[];
    roots?: string[];
  } = { kind: "auto" };
  const configHints: { libraries?: string[]; roots?: string[]; rootDir: string } = {
    rootDir,
  };
  if (projectRoots && projectRoots.length > 0) {
    scope.roots = projectRoots;
    configHints.roots = projectRoots;
  } else if (libraries.length > 0) {
    scope.libraries = libraries;
    configHints.libraries = libraries;
  } else {
    scope.roots = [srcDir];
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

  const diagnostics = [...bootstrap.diagnostics, ...result.diagnostics];
  printDiagnostics(diagnostics, lines);

  const output = result.output;
  const hasErrors = diagnostics.some((d) => d.severity === "error");
  const noOutput =
    !output || (output.files.length === 0 && !(output.rootFiles?.length));
  if (!result.success || hasErrors || !output || noOutput) {
    printCompileFailure(lines, diagnostics, noOutput && !hasErrors);
    return 1;
  }

  const writeResult = writeOutputFiles(output, outDir, rootDir, {
    cleanOutDir: true,
  });
  const rootNote =
    writeResult.rootFilesWritten.length > 0
      ? ` and ${writeResult.rootFilesWritten.join(", ")}`
      : "";
  printCompileSuccess(
    lines,
    `Wrote ${writeResult.filesWritten} file(s) to ${outDir}/${rootNote}`,
  );
  return 0;
}

async function runCompile(
  parsed: ParsedArgs,
  rootDir: string,
  lines: CliOutputLine[],
): Promise<number> {
  let config: BomConfig;
  try {
    config = loadConfig(rootDir);
  } catch (e) {
    pushLines(lines, e instanceof Error ? e.message : String(e), "error");
    return 2;
  }

  const target = parsed.target ?? config.defaultTarget ?? "blockdoc";

  try {
    await bootstrapTargets(config, [target], rootDir);
  } catch (e) {
    pushLines(lines, e instanceof Error ? e.message : String(e), "error");
    return 2;
  }

  const registered = getTarget(target);
  if (!registered) {
    pushLines(lines, `Unknown target: ${target}`, "error");
    return 2;
  }

  if (parsed.perPackage) {
    const hints = getTargetCliHints(target);
    if (!isDocumentOnlyTarget(registered) || !hints?.defaultHostFromPackageLibrary) {
      pushLines(lines, "--per-package is only valid for fatblock.", "error");
      pushLines(lines, USAGE, "info");
      return 2;
    }
    return runCompilePerPackage(target, parsed, rootDir, lines);
  }

  if (isDocumentOnlyTarget(registered)) {
    return runCompileDocument(target, parsed, rootDir, config, lines);
  }

  return runCompileCorpus(target, parsed, rootDir, config, lines);
}

async function executeCli(
  argv: string[],
  cwd: string,
  options: CliRunOptions = {},
): Promise<{ code: number; lines: CliOutputLine[] }> {
  const lines: CliOutputLine[] = [];
  try {
    const parsed = parseArgs(argv);

    if (parsed.help || parsed.command === "help" || parsed.subcommand === "help") {
      const command = parsed.command === "help" ? undefined : parsed.command;
      pushLines(lines, helpFor(command), "info");
      return { code: 0, lines };
    }

    if (parsed.command === "validate") {
      const code = runValidate(parsed, cwd, lines);
      return { code, lines };
    }

    if (parsed.command === "search") {
      let config: BomConfig;
      try {
        config = loadConfig(cwd);
      } catch (e) {
        pushLines(lines, e instanceof Error ? e.message : String(e), "error");
        return { code: 2, lines };
      }
      const code = await runSearch(parsed, cwd, config, lines, formatDiagnostic, SEARCH_USAGE);
      return { code, lines };
    }

    if (parsed.command === "graph") {
      let config: BomConfig;
      try {
        config = loadConfig(cwd);
      } catch (e) {
        pushLines(lines, e instanceof Error ? e.message : String(e), "error");
        return { code: 2, lines };
      }
      const code = await runGraph(parsed, cwd, config, lines, formatDiagnostic, GRAPH_USAGE);
      return { code, lines };
    }

    if (parsed.command === "scan") {
      let config: BomConfig;
      try {
        config = loadConfig(cwd);
      } catch (e) {
        pushLines(lines, e instanceof Error ? e.message : String(e), "error");
        return { code: 2, lines };
      }
      const code = runScan(parsed, cwd, config, lines, SCAN_USAGE);
      return { code, lines };
    }

    if (parsed.command === "inspect") {
      let config: BomConfig;
      try {
        config = loadConfig(cwd);
      } catch (e) {
        pushLines(lines, e instanceof Error ? e.message : String(e), "error");
        return { code: 2, lines };
      }
      const code = await runInspect(parsed, cwd, config, lines, INSPECT_USAGE);
      return { code, lines };
    }

    if (parsed.command === "transform") {
      if (parsed.subcommand !== "apply") {
        if (!parsed.subcommand) {
          pushLines(lines, "Specify a transform subcommand.", "error");
        } else {
          pushLines(lines, `Unknown transform subcommand: ${parsed.subcommand}.`, "error");
        }
        pushLines(lines, USAGE, "info");
        return { code: 2, lines };
      }
      const verbose = parsed.verbose === true;
      const agent = options.transformAgent ?? defaultTransformAgent(verbose);
      const code = await runTransform(
        parsed.executionFqn,
        cwd,
        lines,
        USAGE,
        agent,
        options.reflectAgent,
        options.onOutputLine,
        parsed.parametersJson,
        parsed.parameterMappingsJson,
        parsed.library,
      );
      return { code, lines };
    }

    if (parsed.command === "new") {
      let config: BomConfig;
      try {
        config = loadConfig(cwd);
      } catch (e) {
        pushLines(lines, e instanceof Error ? e.message : String(e), "error");
        return { code: 2, lines };
      }
      const code = runNew(parsed, cwd, config, lines, USAGE);
      return { code, lines };
    }

    if (parsed.command === "init") {
      const result = initProject({
        packageFqn: parsed.initFqn ?? "",
        rootDir: cwd,
        ...(parsed.srcDir !== undefined ? { srcDir: parsed.srcDir } : {}),
        noInstall: parsed.noInstall === true,
      });
      lines.push(...result.lines);
      if (!parsed.initFqn?.trim()) {
        pushLines(lines, USAGE, "info");
      }
      return { code: result.code, lines };
    }

    if (parsed.command === "agents-md") {
      if (parsed.subcommand !== "generate") {
        pushLines(lines, AGENTS_MD_USAGE, "info");
        return { code: 2, lines };
      }
      let srcDir = parsed.srcDir;
      if (srcDir === undefined) {
        try {
          srcDir = loadConfig(cwd).srcDir;
        } catch (e) {
          pushLines(lines, e instanceof Error ? e.message : String(e), "error");
          return { code: 2, lines };
        }
      }
      const result = generateAgentsMd({
        rootDir: cwd,
        ...(srcDir !== undefined ? { srcDir } : {}),
      });
      lines.push(...result.lines);
      return { code: result.code, lines };
    }

    if (parsed.command !== "compile") {
      pushLines(lines, USAGE, "info");
      return { code: 2, lines };
    }

    const code = await runCompile(parsed, cwd, lines);
    return { code, lines };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    pushLines(lines, `Internal CLI error: ${message}`, "error");
    return { code: 2, lines };
  }
}

export async function runCli(
  argv: string[],
  cwd = process.cwd(),
  options: CliRunOptions = {},
): Promise<{ code: number; stderr: string }> {
  const { code, lines } = await executeCli(argv, cwd, options);
  return { code, stderr: formatCliOutput(lines) };
}

/** True when argv[1] is this CLI module, including an npm `.bin` symlink to it. */
export function isCliEntry(argv1: string | undefined, modulePath: string): boolean {
  if (!argv1) {
    return false;
  }
  try {
    return realpathSync(argv1) === realpathSync(modulePath);
  } catch {
    return resolve(argv1) === resolve(modulePath);
  }
}

if (isCliEntry(process.argv[1], fileURLToPath(import.meta.url))) {
  let streamed = false;
  const { code, lines } = await executeCli(process.argv.slice(2), process.cwd(), {
    onOutputLine: (line) => {
      streamed = true;
      writeCliOutput([line]);
    },
  });
  if (!streamed) {
    writeCliOutput(lines);
  }
  process.exitCode = code;
}
