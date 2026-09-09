import {
  bootstrapFullProjectRegistry,
  scanPackages,
  scanTypes,
  type ScanResult,
} from "@blockml/framework";
import { pushLines, type CliOutputLine } from "./cli-style.js";
import type { BomConfig } from "./load-config.js";

export interface ScanCliArgs {
  subcommand?: string;
  selectors?: string[];
  json?: boolean;
  srcDir?: string;
  libraries?: string[];
}

const SCAN_KINDS = new Set(["package", "type"]);

function scanCorpus(
  kind: "package" | "type",
  selectors: string[],
  rootDir: string,
  parsed: ScanCliArgs,
  config: BomConfig,
): ScanResult {
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

export function runScan(
  parsed: ScanCliArgs,
  rootDir: string,
  config: BomConfig,
  lines: CliOutputLine[],
  usage: string,
): number {
  const kind = parsed.subcommand?.trim() ?? "";
  if (!SCAN_KINDS.has(kind)) {
    if (!kind) {
      pushLines(lines, "Specify a scan subcommand: package or type.", "error");
    } else {
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

  const result = scanCorpus(kind as "package" | "type", selectors, rootDir, parsed, config);
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
