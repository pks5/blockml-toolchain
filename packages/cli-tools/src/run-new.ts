import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { BomBuilder, DEFAULT_BASE_TYPE, shortNameOfFqn } from "@blockml/builder";
import type { TypeRegistry } from "@blockml/framework";
import { bootstrapFullProjectRegistry } from "@blockml/framework";
import { parse } from "@blockml/parser";
import { serialize } from "@blockml/serializer";
import { pushLines, type CliOutputLine } from "./cli-style.js";
import type { BomConfig } from "./load-config.js";

export interface NewCliArgs {
  newFqn?: string;
  newBaseType?: string;
  newIs?: string;
  srcDir?: string;
  libraries?: string[];
}

const FQN_SEGMENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function isValidBlockFqn(fqn: string): boolean {
  const parts = fqn.split(".");
  return parts.length >= 2 && parts.every((part) => FQN_SEGMENT.test(part));
}

export function locateOwningLibrary(
  registry: TypeRegistry,
  fqn: string,
): { libraryFqn: string; libraryFile: string; packageFqn: string } | undefined {
  const parts = fqn.split(".");
  parts.pop();
  while (parts.length > 0) {
    const packageFqn = parts.join(".");
    const libraryFqn = `${packageFqn}.Library`;
    const doc = registry.get(libraryFqn);
    const libraryFile = doc?.source.filePath;
    if (libraryFile && !libraryFile.startsWith("<")) {
      return { libraryFqn, libraryFile, packageFqn };
    }
    parts.pop();
  }
  return undefined;
}

export function destinationPathForNew(
  fqn: string,
  owning: { libraryFile: string; packageFqn: string } | undefined,
  rootDir: string,
  srcDir: string,
): string {
  if (owning) {
    const relativeFqn = fqn.slice(owning.packageFqn.length + 1);
    const relParts = relativeFqn.split(".");
    const name = relParts.pop() ?? shortNameOfFqn(fqn);
    return join(dirname(owning.libraryFile), ...relParts, `${name}.bml`);
  }
  const parts = fqn.split(".");
  const name = parts.pop() ?? fqn;
  return join(rootDir, srcDir, ...parts, `${name}.bml`);
}

function displayPath(file: string, rootDir: string): string {
  const rel = relative(rootDir, file);
  return rel && !rel.startsWith("..") ? rel : file;
}

export function runNew(
  parsed: NewCliArgs,
  rootDir: string,
  config: BomConfig,
  lines: CliOutputLine[],
  usage: string,
): number {
  const fqn = parsed.newFqn?.trim();
  if (!fqn) {
    pushLines(lines, "Specify a Block FQN.", "error");
    pushLines(lines, usage, "info");
    return 2;
  }
  if (!isValidBlockFqn(fqn)) {
    pushLines(lines, `Invalid Block FQN: ${fqn}`, "error");
    return 2;
  }

  const srcDir = parsed.srcDir ?? config.srcDir ?? "blocks";
  const bootstrapOptions: { rootDir: string; srcDir: string; libraries?: string[] } = {
    rootDir,
    srcDir,
  };
  const libraries = parsed.libraries ?? config.libraries;
  if (libraries) {
    bootstrapOptions.libraries = libraries;
  }
  const { registry } = bootstrapFullProjectRegistry(bootstrapOptions);

  if (registry.has(fqn)) {
    pushLines(lines, `Block already exists: ${fqn}`, "error");
    return 1;
  }

  const baseType = parsed.newBaseType?.trim() || DEFAULT_BASE_TYPE;
  if (!registry.has(baseType)) {
    pushLines(lines, `Unknown baseType: ${baseType}`, "error");
    return 2;
  }

  const owning = locateOwningLibrary(registry, fqn);
  const destPath = destinationPathForNew(fqn, owning, rootDir, srcDir);
  if (existsSync(destPath)) {
    pushLines(lines, `File already exists: ${displayPath(destPath, rootDir)}`, "error");
    return 1;
  }

  const idea = parsed.newIs?.trim() || shortNameOfFqn(fqn);
  const sealed = BomBuilder.create({
    type: fqn,
    baseType,
    is: idea,
    filePath: destPath,
  }).seal();
  const emitted = serialize(sealed);
  if (!emitted.success || emitted.text === null) {
    pushLines(lines, `Failed to serialize ${fqn}`, "error");
    return 1;
  }
  mkdirSync(dirname(destPath), { recursive: true });
  writeFileSync(destPath, emitted.text, "utf8");
  pushLines(lines, `Created ${displayPath(destPath, rootDir)}`, "info");

  if (!owning) {
    pushLines(lines, "No owning Library found; catalog was not updated.", "info");
    return 0;
  }

  const librarySource = readFileSync(owning.libraryFile, "utf8");
  const parsedLibrary = parse(librarySource, {
    filePath: owning.libraryFile,
    continueOnError: true,
  });
  if (!parsedLibrary.document) {
    pushLines(
      lines,
      `Created the Block but could not parse Library ${owning.libraryFqn}.`,
      "error",
    );
    return 1;
  }
  try {
    const updated = BomBuilder.edit(parsedLibrary.document)
      .addCompositionChild("blocks", fqn)
      .seal();
    const libraryXml = serialize(updated);
    if (!libraryXml.success || libraryXml.text === null) {
      pushLines(lines, `Failed to serialize Library ${owning.libraryFqn}`, "error");
      return 1;
    }
    writeFileSync(owning.libraryFile, libraryXml.text, "utf8");
    pushLines(
      lines,
      `Updated catalog ${displayPath(owning.libraryFile, rootDir)}`,
      "info",
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    pushLines(
      lines,
      `Created the Block but could not update Library catalog: ${message}`,
      "error",
    );
    return 1;
  }
  return 0;
}
