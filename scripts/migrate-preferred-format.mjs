#!/usr/bin/env node
/**
 * Rewrite BML sources to the preferred type-or-name tag form (doc:DocumentFormat).
 * Drops xsi / schemaLocation. Does not rewrite node_modules.
 *
 * Default scope is org.blockml.bml.workspace. Pass --all to convert every
 * workspace .bml except node_modules.
 *
 * Usage:
 *   node scripts/migrate-preferred-format.mjs
 *   node scripts/migrate-preferred-format.mjs --pkg org.blockml.bml.workspace
 *   node scripts/migrate-preferred-format.mjs --src blocks/org/blockml/bml/workspace
 *   node scripts/migrate-preferred-format.mjs --all
 *   node scripts/migrate-preferred-format.mjs --dry-run
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "@blockml/parser";
import { serialize } from "@blockml/serializer";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const XSI_URI = "http://www.w3.org/2001/XMLSchema-instance";
const DEFAULT_PKG = "org.blockml.bml.workspace";

function parseArgs(argv) {
  const opts = { pkg: DEFAULT_PKG, src: undefined, all: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--all") {
      opts.all = true;
    } else if (arg === "--dry-run") {
      opts.dryRun = true;
    } else if (arg === "--pkg") {
      opts.pkg = argv[++i];
    } else if (arg === "--src") {
      opts.src = argv[++i];
    } else if (arg === "--help" || arg === "-h") {
      opts.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

function walkFiles(dir, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") {
      continue;
    }
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, out);
    } else if (entry.name.endsWith(".bml")) {
      out.push(full);
    }
  }
}

function pkgToRelPath(pkg) {
  return pkg.replaceAll(".", "/");
}

function collectTargets(opts) {
  const files = [];
  if (opts.src) {
    const dir = resolve(ROOT, opts.src);
    if (!statSync(dir).isDirectory()) {
      throw new Error(`--src is not a directory: ${opts.src}`);
    }
    walkFiles(dir, files);
    return files;
  }
  if (opts.all) {
    walkFiles(ROOT, files);
    return files;
  }
  const needle = pkgToRelPath(opts.pkg);
  walkFiles(ROOT, files);
  return files.filter((file) => relative(ROOT, file).split("\\").join("/").includes(needle));
}

function hasXsiBinding(bindings) {
  if (!bindings) {
    return false;
  }
  return Object.entries(bindings).some(
    ([prefix, uri]) => prefix === "xsi" || uri === XSI_URI,
  );
}

function hasPairedEmptySee(block) {
  for (const ref of block.references ?? []) {
    if (ref.context.trim() === "" && ref.authoredEmptyElementForm === "paired") {
      return true;
    }
  }
  for (const member of block.members ?? []) {
    for (const ref of member.references ?? []) {
      if (ref.context.trim() === "" && ref.authoredEmptyElementForm === "paired") {
        return true;
      }
    }
  }
  return false;
}

function definitionNeedsRewrite(block, _role) {
  if (block.wrapperForm !== "type") {
    return true;
  }
  if (block.authoredTypeChild || block.authoredNameChild) {
    return true;
  }
  if (hasPairedEmptySee(block)) {
    return true;
  }
  for (const sub of block.subBlocks ?? []) {
    if (definitionNeedsRewrite(sub, "subBlock")) {
      return true;
    }
  }
  for (const emb of block.embeddedBlocks ?? []) {
    if (definitionNeedsRewrite(emb, "embedded")) {
      return true;
    }
  }
  return false;
}

function needsRewrite(document) {
  const source = document.source;
  if (source.rootForm !== "type") {
    return true;
  }
  if (source.schemaLocation || source.noNamespaceSchemaLocation) {
    return true;
  }
  if (hasXsiBinding(source.namespaceBindings)) {
    return true;
  }
  return definitionNeedsRewrite(document.block, "root");
}

function preferDefinition(block) {
  block.wrapperForm = "type";
  delete block.authoredNameChild;
  delete block.authoredTypeChild;
  for (const sub of block.subBlocks ?? []) {
    preferDefinition(sub);
  }
  for (const emb of block.embeddedBlocks ?? []) {
    preferDefinition(emb);
  }
}

function stripXsi(source) {
  source.rootForm = "type";
  delete source.schemaLocation;
  delete source.noNamespaceSchemaLocation;
  if (!source.namespaceBindings) {
    return;
  }
  const next = { ...source.namespaceBindings };
  for (const [prefix, uri] of Object.entries(next)) {
    if (prefix === "xsi" || uri === XSI_URI) {
      delete next[prefix];
    }
  }
  source.namespaceBindings = next;
}

const TYPE_AS_ROOT_LOCAL = /^(?:_+)?[A-Z][A-Za-z0-9_]*$/;

function tagLocalName(typeFqn, bindings) {
  const entries = Object.entries(bindings ?? {}).filter(
    ([prefix, uri]) => prefix !== "" && uri !== XSI_URI && uri !== "http://blockml.org/bml",
  );
  let bestUri = "";
  for (const [, uri] of entries) {
    if (typeFqn.startsWith(`${uri}.`) && uri.length > bestUri.length) {
      bestUri = uri;
    }
  }
  if (!bestUri) {
    const last = typeFqn.split(".").pop() ?? typeFqn;
    return last;
  }
  return typeFqn.slice(bestUri.length + 1);
}

function canUseTypeAsRoot(document) {
  const local = tagLocalName(document.block.type, document.source.namespaceBindings);
  return TYPE_AS_ROOT_LOCAL.test(local);
}

function migrateDocument(document) {
  stripXsi(document.source);
  preferDefinition(document.block);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(`Usage: node scripts/migrate-preferred-format.mjs [--pkg fqn] [--src dir] [--all] [--dry-run]`);
    process.exit(0);
  }

  const files = collectTargets(opts);
  if (files.length === 0) {
    console.error("No .bml files found.");
    process.exit(1);
  }

  let rewritten = 0;
  let skipped = 0;
  let failed = 0;
  for (const file of files) {
    const rel = relative(ROOT, file);
    const text = readFileSync(file, "utf8");
    const parsed = parse(text, { filePath: rel, continueOnError: true });
    if (!parsed.document) {
      failed += 1;
      console.error(`skip (parse failed): ${rel}`);
      for (const d of parsed.diagnostics.filter((x) => x.severity === "error")) {
        console.error(`  ${d.code} ${d.message}`);
      }
      continue;
    }
    if (!needsRewrite(parsed.document)) {
      skipped += 1;
      continue;
    }
    if (!canUseTypeAsRoot(parsed.document)) {
      skipped += 1;
      console.error(`skip (type tag would not be a TypeIdentifier): ${rel}`);
      continue;
    }
    migrateDocument(parsed.document);
    const result = serialize(parsed.document);
    if (!result.success || !result.text) {
      failed += 1;
      console.error(`skip (serialize failed): ${rel}`);
      continue;
    }
    const next = result.text.endsWith("\n") ? result.text : `${result.text}\n`;
    if (next === text) {
      skipped += 1;
      continue;
    }
    if (!opts.dryRun) {
      writeFileSync(file, next);
    }
    rewritten += 1;
    console.log(`${opts.dryRun ? "would rewrite" : "rewrote"} ${rel}`);
  }

  console.log(
    `${opts.dryRun ? "dry-run " : ""}rewritten=${rewritten} unchanged=${skipped} failed=${failed} scanned=${files.length}`,
  );
  if (failed > 0) {
    process.exit(1);
  }
}

main();
