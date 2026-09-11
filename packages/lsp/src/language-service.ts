import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import type { BomDocument, Diagnostic } from "@blockml/bom";
import {
  projectSourceRoots,
  registryFilesUnderRoots,
  rootFqnByFilePath,
} from "@blockml/framework";
import { parse } from "@blockml/parser";
import { serialize } from "@blockml/serializer";
import { validate } from "@blockml/validator";
import { workspaceWithOpenDocument, type WorkspaceState } from "./workspace.js";

export interface AnalysisResult {
  diagnostics: Diagnostic[];
  document: BomDocument | null;
}

export function analyzeDocument(
  text: string,
  filePath: string,
  workspace: WorkspaceState,
): AnalysisResult {
  const parseResult = parse(text, { filePath, continueOnError: true });
  const diagnostics: Diagnostic[] = [...parseResult.diagnostics];

  if (!parseResult.document) {
    return { diagnostics, document: null };
  }

  const scoped = workspaceWithOpenDocument(workspace, parseResult.document);
  const validateResult = validate(parseResult.document, {
    typeRegistry: scoped.registry,
    continueOnError: true,
  });
  diagnostics.push(...validateResult.diagnostics);

  return {
    diagnostics,
    document: parseResult.document,
  };
}

export interface WorkspaceAnalysisResult {
  filePaths: string[];
  diagnostics: Diagnostic[];
}

function collectBmlFiles(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === "node_modules") {
      continue;
    }
    const full = join(dir, entry);
    try {
      const st = statSync(full);
      if (st.isDirectory()) {
        collectBmlFiles(full, out);
      } else if (entry.endsWith(".bml")) {
        out.push(resolve(full));
      }
    } catch {
      continue;
    }
  }
  return out;
}

function projectWorkspaceRoots(workspace: WorkspaceState): string[] {
  return projectSourceRoots(workspace.rootDir, workspace.config.srcDir ?? "blocks");
}

/** Absolute project-source .bml paths (registry + unregistered disk files). */
export function listProjectWorkspaceFiles(workspace: WorkspaceState): string[] {
  const roots = projectWorkspaceRoots(workspace);
  const seen = new Set<string>();
  const files: string[] = [];
  const add = (filePath: string): void => {
    const abs = resolve(filePath);
    if (seen.has(abs)) {
      return;
    }
    seen.add(abs);
    files.push(abs);
  };
  for (const filePath of registryFilesUnderRoots(workspace.registry, roots)) {
    add(filePath);
  }
  for (const root of roots) {
    for (const filePath of collectBmlFiles(root)) {
      add(filePath);
    }
  }
  return files.sort();
}

/** Validate a registry document, or parse-only when the file never entered the registry. */
export function analyzeProjectWorkspaceFile(
  workspace: WorkspaceState,
  filePath: string,
): Diagnostic[] {
  const abs = resolve(filePath);
  const rootByFile = rootFqnByFilePath(workspace.registry);
  let fqn = rootByFile.get(abs) ?? rootByFile.get(filePath);
  if (!fqn) {
    for (const [key, value] of rootByFile) {
      if (resolve(key) === abs) {
        fqn = value;
        break;
      }
    }
  }
  const document = fqn ? workspace.registry.get(fqn) : undefined;
  const diagnostics: Diagnostic[] = [];

  if (document) {
    const result = validate(document, {
      typeRegistry: workspace.registry,
      continueOnError: true,
    });
    diagnostics.push(...result.diagnostics);
  } else if (existsSync(abs)) {
    try {
      const text = readFileSync(abs, "utf8");
      const parsed = parse(text, { filePath: abs, continueOnError: true });
      diagnostics.push(...parsed.diagnostics);
    } catch (e) {
      diagnostics.push({
        severity: "warning",
        code: "BML_BOOTSTRAP_READ_ERROR",
        message: e instanceof Error ? e.message : String(e),
        source: { file: abs, line: 1, column: 1 },
      });
    }
  }

  for (const diagnostic of workspace.bootstrapDiagnostics) {
    const file = diagnostic.source?.file;
    if (file && resolve(file) === abs) {
      diagnostics.push(diagnostic);
    }
  }

  return diagnostics;
}

export function analyzeWorkspace(workspace: WorkspaceState): WorkspaceAnalysisResult {
  const filePaths = listProjectWorkspaceFiles(workspace);
  const diagnostics: Diagnostic[] = [];
  for (const filePath of filePaths) {
    diagnostics.push(...analyzeProjectWorkspaceFile(workspace, filePath));
  }
  return { filePaths, diagnostics };
}

export interface FormatDocumentOptions {
  indent?: number;
  xmlDeclaration?: boolean;
}

function hasXmlDeclaration(text: string): boolean {
  return /^\s*<\?xml\b/.test(text);
}

export function formatDocument(
  text: string,
  options: FormatDocumentOptions = {},
): string | null {
  const parseResult = parse(text, { continueOnError: true });
  if (!parseResult.document) {
    return null;
  }

  const serializeOptions: {
    indent?: number;
    xmlDeclaration?: boolean;
  } = {
    xmlDeclaration: options.xmlDeclaration ?? hasXmlDeclaration(text),
  };
  if (options.indent !== undefined) {
    serializeOptions.indent = options.indent;
  }

  const result = serialize(parseResult.document, serializeOptions);
  return result.text;
}
