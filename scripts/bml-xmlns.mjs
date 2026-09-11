/**
 * Emit only xmlns prefixes that appear as QNames in a generated BML document.
 * Drops xmlns:xsi / xsi:schemaLocation (doc:DocumentFormat — XSD is not the
 * authoring validator). Default xmlns is always kept.
 *
 *   node scripts/bml-xmlns.mjs
 *   node scripts/bml-xmlns.mjs --prune [--dry-run] [dir…]
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const QNAME = /(?<![A-Za-z0-9_:])([A-Za-z_][\w.-]*):[A-Za-z_]/g;

function structuralText(xml) {
  return xml
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "")
    .replace(/<documentation\b[^>]*>[\s\S]*?<\/documentation>/g, "");
}

export function collectUsedPrefixes(xml) {
  const used = new Set();
  for (const line of structuralText(xml).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (
      trimmed.startsWith("xmlns:") ||
      trimmed.startsWith("xmlns=") ||
      trimmed.startsWith("xsi:")
    ) {
      continue;
    }
    for (const match of line.matchAll(QNAME)) {
      const prefix = match[1];
      if (prefix !== "xmlns" && prefix !== "xsi") {
        used.add(prefix);
      }
    }
  }
  return used;
}

export function pruneUnusedXmlns(xml) {
  const used = collectUsedPrefixes(xml);
  let next = xml.replace(/\s+xmlns:xsi="[^"]*"/g, "");
  next = next.replace(/\s+xsi:schemaLocation="[^"]*"/g, "");
  next = next.replace(/\s+xmlns:([A-Za-z_][\w.-]*)="[^"]*"/g, (full, prefix) =>
    used.has(prefix) ? full : "",
  );
  return next;
}

function writeBml(writeFileSync, path, data, encoding) {
  const body = typeof data === "string" && String(path).endsWith(".bml")
    ? pruneUnusedXmlns(data)
    : data;
  return writeFileSync(path, body, encoding);
}

export function bindWriteFileSync(writeFileSync) {
  return (path, data, encoding) => writeBml(writeFileSync, path, data, encoding);
}

function assertSelfTest() {
  const xml = `<!-- doc -->
<block
  xmlns="http://blockml.org/bml"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://blockml.org/bml https://blockml.org/schemas/bml.xsd
                      "
  xmlns:blockml="org.blockml.bml"
  xmlns:core="org.blockml.bml.core"
  xmlns:fwcap="org.blockml.bml.framework.capability"
  xmlns:type="org.blockml.bml.type">

  <type>fwcap:ValidateTypes</type>
  <baseType>core:Capability</baseType>
  <documentation>mentions type:Text only in prose</documentation>
</block>
`;
  const out = pruneUnusedXmlns(xml);
  const used = [...collectUsedPrefixes(xml)].sort().join(",");
  if (used !== "core,fwcap") {
    throw new Error(`expected used prefixes core,fwcap; got ${used}`);
  }
  if (
    out.includes("xmlns:xsi") ||
    out.includes("schemaLocation") ||
    out.includes("xmlns:blockml") ||
    out.includes("xmlns:type=") ||
    out.includes('bml""') ||
    !out.includes('xmlns="http://blockml.org/bml"') ||
    !out.includes("xmlns:core=") ||
    !out.includes("xmlns:fwcap=")
  ) {
    throw new Error(`unexpected prune result:\n${out}`);
  }
}

const SKIP_DIRS = new Set(["node_modules", "dist", ".git", "test", "coverage"]);

function walkBml(dir, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        walkBml(join(dir, entry.name), out);
      }
      continue;
    }
    if (entry.name.endsWith(".bml")) {
      out.push(join(dir, entry.name));
    }
  }
}

function defaultRoots(repoRoot) {
  const roots = [join(repoRoot, "blocks")];
  const packagesDir = join(repoRoot, "packages");
  for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const blocks = join(packagesDir, entry.name, "blocks");
    if (existsSync(blocks)) {
      roots.push(blocks);
    }
  }
  return roots;
}

export function pruneTree(roots, { dryRun = false, repoRoot = process.cwd() } = {}) {
  const files = [];
  for (const root of roots) {
    walkBml(root, files);
  }
  let rewritten = 0;
  let unchanged = 0;
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const next = pruneUnusedXmlns(text);
    if (next === text) {
      unchanged += 1;
      continue;
    }
    rewritten += 1;
    if (!dryRun) {
      writeFileSync(file, next);
    }
    console.log(`${dryRun ? "would prune" : "pruned"} ${relative(repoRoot, file)}`);
  }
  return { rewritten, unchanged, scanned: files.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argv = process.argv.slice(2);
  if (argv.includes("--prune")) {
    const dryRun = argv.includes("--dry-run");
    const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
    const roots = argv.filter((arg) => !arg.startsWith("--")).map((arg) => resolve(repoRoot, arg));
    const result = pruneTree(roots.length ? roots : defaultRoots(repoRoot), { dryRun, repoRoot });
    console.log(
      `${dryRun ? "dry-run " : ""}pruned=${result.rewritten} unchanged=${result.unchanged} scanned=${result.scanned}`,
    );
  } else {
    assertSelfTest();
    console.log("bml-xmlns self-test ok");
  }
}
