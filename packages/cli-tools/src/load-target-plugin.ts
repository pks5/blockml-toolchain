import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { RenderTarget } from "@blockml/compiler";
import type { BomConfig } from "./load-config.js";

export interface TargetCliHints {
  defaultOutDir?: string | ((config: BomConfig) => string);
  requiresHostFile?: boolean;
  requiresSrcDir?: boolean;
  documentBootstrap?: "project" | "workspace-core";
}

const BUILTIN_TARGETS = new Set(["blockdoc", "xsd", "fatblock"]);

export function isBuiltinTarget(name: string): boolean {
  return BUILTIN_TARGETS.has(name);
}

export function resolveTargetPackage(config: BomConfig, name: string): string | undefined {
  if (isBuiltinTarget(name)) {
    return undefined;
  }
  if (config.targetPackages?.[name]) {
    return config.targetPackages[name];
  }
  if (name.startsWith("@") || name.includes("/")) {
    return name;
  }
  return undefined;
}

interface BlockmlPackageMeta {
  target?: string;
  targetName?: string;
  cliHints?: TargetCliHints;
}

function readBlockmlPackageMeta(packageName: string, rootDir: string): BlockmlPackageMeta {
  try {
    const require = createRequire(pathToFileURL(join(rootDir, "package.json")).href);
    const pkgPath = require.resolve(`${packageName}/package.json`);
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      blockml?: BlockmlPackageMeta;
    };
    return pkg.blockml ?? {};
  } catch {
    if (packageName.startsWith(".") || isAbsolute(packageName)) {
      const pkgPath = resolve(rootDir, packageName, "package.json");
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
        blockml?: BlockmlPackageMeta;
      };
      return pkg.blockml ?? {};
    }
    return {};
  }
}

async function importPackageModule(
  packageName: string,
  rootDir: string,
  entry?: string,
): Promise<Record<string, unknown>> {
  if (packageName.startsWith(".") || isAbsolute(packageName)) {
    const base = resolve(rootDir, packageName);
    const modulePath = entry
      ? resolve(base, entry)
      : resolve(base, "index.js");
    return (await import(pathToFileURL(modulePath).href)) as Record<string, unknown>;
  }

  if (entry && entry.startsWith(".")) {
    const require = createRequire(pathToFileURL(join(rootDir, "package.json")).href);
    const pkgPath = require.resolve(`${packageName}/package.json`);
    const modulePath = resolve(dirname(pkgPath), entry);
    return (await import(pathToFileURL(modulePath).href)) as Record<string, unknown>;
  }

  return (await import(packageName)) as Record<string, unknown>;
}

function resolveTargetFactory(
  mod: Record<string, unknown>,
  registryName: string,
): () => RenderTarget {
  const named = mod[registryName];
  if (typeof named === "function") {
    if ((named as { prototype?: { render?: unknown } }).prototype?.render) {
      const Klass = named as new () => RenderTarget;
      return () => new Klass();
    }
    return named as () => RenderTarget;
  }

  const Default = mod.default;
  if (typeof Default === "function") {
    if ((Default as { prototype?: { render?: unknown } }).prototype?.render) {
      const Klass = Default as new () => RenderTarget;
      return () => new Klass();
    }
    return Default as () => RenderTarget;
  }

  throw new Error(
    `Target package for "${registryName}" must export default class, factory, or named "${registryName}" export`,
  );
}

export async function loadTargetFromPackage(
  packageName: string,
  registryName: string,
  rootDir: string,
): Promise<{
  factory: () => RenderTarget;
  registryName: string;
  hints?: TargetCliHints;
}> {
  const meta = readBlockmlPackageMeta(packageName, rootDir);
  const mod = await importPackageModule(packageName, rootDir, meta.target);
  const resolvedName = meta.targetName ?? registryName;
  const loaded: {
    factory: () => RenderTarget;
    registryName: string;
    hints?: TargetCliHints;
  } = {
    factory: resolveTargetFactory(mod, resolvedName),
    registryName: resolvedName,
  };
  if (meta.cliHints) {
    loaded.hints = meta.cliHints;
  }
  return loaded;
}
