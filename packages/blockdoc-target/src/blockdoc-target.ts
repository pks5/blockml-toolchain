import { readFileSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import type { BlockDefinition } from "@blockml/bom";
import type { CompileRequest, RenderContext, RenderOutput, RenderTarget } from "@blockml/compiler";
import { bootstrapTypeRegistry, getExportedFqns, type TypeRegistry } from "@blockml/framework";
import { parse } from "@blockml/parser";
import { fqnToHtmlPath } from "./fqn-path.js";
import {
  collectPackagePrefixes,
  collectRootFqns,
  rootFqnForBlock,
} from "./navigation.js";
import { renderPackageIndexPage } from "./package-index.js";
import { renderBlockPage, renderIndexPage } from "./render-block-page.js";
import { resolveBlockDocOptions } from "./options.js";
import {
  buildSearchIndexEntry,
  serializeSearchIndex,
  type SearchIndexEntry,
} from "./search-index.js";
import { renderSearchScript } from "./toolbar.js";

export interface BlockDocRenderOutput extends RenderOutput {
  files: { path: string; content: string }[];
}

interface LibraryRoot {
  prefix: string;
  indexPath: string;
}

function canonicalPath(path: string): string {
  const abs = resolve(path);
  try {
    return realpathSync(abs);
  } catch {
    return abs;
  }
}

function isPathInsideOrEqual(inner: string, outer: string): boolean {
  const a = canonicalPath(inner);
  const b = canonicalPath(outer);
  const rel = relative(b, a);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function collectExportedFqns(libraryPaths: string[], rootDir: string): Set<string> {
  const bootstrap = bootstrapTypeRegistry({ libraryPaths, rootDir });
  const exported = new Set<string>();
  for (const libPath of libraryPaths) {
    const fqns = getExportedFqns(libPath, bootstrap, rootDir);
    if (fqns) {
      for (const fqn of fqns) {
        exported.add(fqn);
      }
    }
  }
  return exported;
}

function fqnFileIsUnderRoots(registry: TypeRegistry, fqn: string, roots: string[]): boolean {
  const doc = registry.get(fqn);
  const filePath = doc?.source?.filePath;
  if (!filePath || filePath.startsWith("<")) {
    return false;
  }
  return roots.some((root) => isPathInsideOrEqual(filePath, root));
}

function filterFqnsByCorpusRoots(ctx: RenderContext, fqns: string[]): string[] {
  const roots = ctx.session.corpusRoots;
  if (!roots?.length) {
    return fqns;
  }
  const registry = ctx.session.typeRegistry;
  return fqns.filter((fqn) => fqnFileIsUnderRoots(registry, fqn, roots));
}

function collectBlockFqns(ctx: RenderContext, request: CompileRequest): string[] {
  const options = resolveBlockDocOptions(request.targetOptions);
  const registry = ctx.session.typeRegistry;
  let fqns = registry.keys();

  if (!options.includeNonExported && ctx.session.libraryPaths?.length) {
    const rootDir = process.cwd();
    const exported = collectExportedFqns(ctx.session.libraryPaths, rootDir);
    fqns = fqns.filter((fqn) => exported.has(fqn));
  }

  return [...new Set(filterFqnsByCorpusRoots(ctx, fqns))].sort();
}

function collectRootBlockFqns(ctx: RenderContext, request: CompileRequest): string[] {
  const options = resolveBlockDocOptions(request.targetOptions);
  const registry = ctx.session.typeRegistry;
  let rootFqns = collectRootFqns(registry);

  if (!options.includeNonExported && ctx.session.libraryPaths?.length) {
    const rootDir = process.cwd();
    const exported = collectExportedFqns(ctx.session.libraryPaths, rootDir);
    rootFqns = rootFqns.filter((fqn) => exported.has(fqn));
  }

  return filterFqnsByCorpusRoots(ctx, rootFqns);
}

function findBlock(root: BlockDefinition, fqn: string): BlockDefinition | undefined {
  if (root.type === fqn) {
    return root;
  }
  for (const sub of root.subBlocks) {
    const found = findBlock(sub, fqn);
    if (found) {
      return found;
    }
  }
  return undefined;
}

function collectLibraryRoots(libraryPaths: string[], rootDir: string): LibraryRoot[] {
  const roots: LibraryRoot[] = [];
  for (const libPath of libraryPaths) {
    const abs = resolve(rootDir, libPath);
    let source: string;
    try {
      source = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    const parsed = parse(source, { filePath: abs, continueOnError: true });
    const libFqn = parsed.document?.block.type;
    if (!libFqn) {
      continue;
    }
    const prefix = libFqn.replace(/\.Library$/, "");
    roots.push({
      prefix,
      indexPath: `${prefix.split(".").join("/")}/index.html`,
    });
  }
  return roots;
}

function resolveRootIndexPath(
  fqn: string,
  options: ReturnType<typeof resolveBlockDocOptions>,
  libraryRoots: LibraryRoot[],
): string {
  if (options.siteMode === "perLibrary") {
    for (const lib of libraryRoots) {
      if (fqn.startsWith(`${lib.prefix}.`) || fqn === lib.prefix) {
        return lib.indexPath;
      }
    }
  }
  return "index.html";
}

export class BlockDocTarget implements RenderTarget {
  readonly name = "blockdoc";
  readonly accepts: Array<"library" | "corpus" | "auto"> = ["library", "corpus", "auto"];

  render(request: CompileRequest, ctx: RenderContext): BlockDocRenderOutput {
    const options = resolveBlockDocOptions(request.targetOptions);
    const fqns = collectBlockFqns(ctx, request);
    const rootFqns = collectRootBlockFqns(ctx, request);
    const knownFqns = new Set(fqns);
    const files: BlockDocRenderOutput["files"] = [];
    const searchEntries: SearchIndexEntry[] = [];
    const rootDir = process.cwd();
    const libraryRoots =
      options.siteMode === "perLibrary" && ctx.session.libraryPaths?.length
        ? collectLibraryRoots(ctx.session.libraryPaths, rootDir)
        : [];

    for (const fqn of fqns) {
      const doc = ctx.session.typeRegistry.get(fqn);
      if (!doc) {
        continue;
      }
      const block = doc.block.type === fqn ? doc.block : findBlock(doc.block, fqn);
      if (!block) {
        continue;
      }
      const rootFqn = rootFqnForBlock(fqn, rootFqns) ?? fqn;
      const pagePath =
        options.outLayout === "fqn"
          ? fqnToHtmlPath(fqn, "fqn")
          : fqnToHtmlPath(fqn, "package");
      searchEntries.push(buildSearchIndexEntry(block, pagePath));
      files.push({
        path: pagePath,
        content: renderBlockPage(
          block,
          options,
          resolveRootIndexPath(rootFqn, options, libraryRoots),
          knownFqns,
          rootFqn,
        ),
      });
    }

    if (options.siteMode === "perLibrary" && ctx.session.libraryPaths?.length) {
      for (const lib of libraryRoots) {
        const libRootFqns = rootFqns.filter(
          (f) => f.startsWith(`${lib.prefix}.`) || f === lib.prefix,
        );
        files.push({
          path: lib.indexPath,
          content: renderIndexPage(
            `${lib.prefix} — BlockDoc`,
            libRootFqns,
            options,
            lib.indexPath,
          ),
        });
      }
    } else {
      files.push({
        path: "index.html",
        content: renderIndexPage("BlockDoc", rootFqns, options, "index.html"),
      });
    }

    if (options.outLayout === "fqn") {
      for (const prefix of collectPackagePrefixes(rootFqns)) {
        const indexPath = `${prefix.split(".").join("/")}/index.html`;
        const rootIndexPath =
          options.siteMode === "perLibrary"
            ? (libraryRoots.find(
                (lib) => prefix.startsWith(`${lib.prefix}.`) || prefix === lib.prefix,
              )?.indexPath ?? "index.html")
            : "index.html";
        files.push({
          path: indexPath,
          content: renderPackageIndexPage(
            prefix,
            rootFqns,
            options,
            indexPath,
            rootIndexPath,
          ),
        });
      }
    }

    files.push({
      path: "search-index.json",
      content: serializeSearchIndex(searchEntries),
    });
    files.push({
      path: "search.js",
      content: renderSearchScript(searchEntries),
    });

    return { files };
  }
}
