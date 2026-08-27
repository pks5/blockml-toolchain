import { isAbsolute, relative, resolve } from "node:path";
import {
  getIndexStatus,
  rebuildIndex,
  search as searchCorpus,
  type SearchIndexOptions,
  type SearchResult,
} from "@blockml/search";
import { diagnosticKind, pushLines, type CliOutputLine } from "./cli-style.js";
import type { BomConfig } from "./load-config.js";

export interface SearchCliArgs {
  query?: string;
  index?: boolean;
  json?: boolean;
  force?: boolean;
  limit?: number;
  srcDir?: string;
  libraries?: string[];
}

function displayPath(file: string, rootDir: string): string {
  const abs = resolve(file);
  const rel = relative(rootDir, abs);
  return rel && !rel.startsWith("..") && !isAbsolute(rel) ? rel : file;
}

function formatScore(score: number): string {
  return score.toFixed(2);
}

function formatHumanHit(hit: SearchResult, rootDir: string): string {
  const file = displayPath(hit.file, rootDir);
  return `${formatScore(hit.score)}  ${hit.fqn}\n      ${file}`;
}

function printDiagnostics(
  diagnostics: { severity: string; code: string; message: string; source?: { file: string; line: number } }[],
  lines: CliOutputLine[],
  formatDiagnostic: (d: {
    severity: string;
    code: string;
    message: string;
    source?: { file: string; line: number };
  }) => string,
): void {
  for (const d of diagnostics) {
    pushLines(lines, formatDiagnostic(d), diagnosticKind(d.severity));
  }
}

function searchOptions(parsed: SearchCliArgs, config: BomConfig, rootDir: string): SearchIndexOptions {
  const options: SearchIndexOptions = { rootDir };
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

export async function runSearch(
  parsed: SearchCliArgs,
  rootDir: string,
  config: BomConfig,
  lines: CliOutputLine[],
  formatDiagnostic: (d: {
    severity: string;
    code: string;
    message: string;
    source?: { file: string; line: number };
  }) => string,
  usage: string,
): Promise<number> {
  const options = searchOptions(parsed, config, rootDir);

  if (parsed.index) {
    const built = await rebuildIndex(options);
    printDiagnostics(built.diagnostics, lines, formatDiagnostic);
    if (!parsed.json) {
      pushLines(lines, `Indexed ${built.documents} blocks.`, "success");
    } else {
      pushLines(
        lines,
        JSON.stringify({ documents: built.documents }, null, 2),
        "info",
      );
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
    } else if (status.state === "stale") {
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
