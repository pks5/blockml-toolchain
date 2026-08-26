import { clearTargets, registerTarget, type RenderTarget } from "@blockml/compiler";
import { BlockDocTarget } from "@blockml/blockdoc-target";
import { FatBlockTarget } from "@blockml/fatblock-target";
import { XsdTarget } from "@blockml/xsd-target";
import type { BomConfig } from "./load-config.js";
import {
  isBuiltinTarget,
  loadTargetFromPackage,
  resolveTargetPackage,
  type TargetCliHints,
} from "./load-target-plugin.js";

const DEFAULT_TARGETS = ["blockdoc"];

let bootstrapped = false;

const BUILTIN_FACTORIES: Record<string, () => RenderTarget> = {
  blockdoc: () => new BlockDocTarget(),
  xsd: () => new XsdTarget(),
  fatblock: () => new FatBlockTarget(),
};


export type { TargetCliHints } from "./load-target-plugin.js";

const BUILTIN_HINTS: Record<string, TargetCliHints> = {
  blockdoc: {
    defaultOutDir: (config) => config.outDir ?? "blockdoc",
  },
  xsd: {
    defaultOutDir: "schemas",
  },
  fatblock: {
    requiresHostFile: true,
    requiresSrcDir: true,
    defaultOutDir: ".",
    defaultHostFromPackageLibrary: true,
    defaultSrcFromHostDir: true,
    documentBootstrap: "workspace-core",
  },
};

const customFactories = new Map<string, () => RenderTarget>();
const customHints = new Map<string, TargetCliHints>();

export function registerTargetFactory(
  name: string,
  factory: () => RenderTarget,
  hints?: TargetCliHints,
): void {
  customFactories.set(name, factory);
  if (hints) {
    customHints.set(name, hints);
  }
}

export function getTargetCliHints(name: string): TargetCliHints | undefined {
  return customHints.get(name) ?? BUILTIN_HINTS[name];
}

export function getTargetFactory(name: string): (() => RenderTarget) | undefined {
  return customFactories.get(name) ?? BUILTIN_FACTORIES[name];
}

export function builtinTargetNames(): string[] {
  return Object.keys(BUILTIN_FACTORIES);
}

export async function bootstrapTargets(
  config: BomConfig,
  requested: string[] = [],
  rootDir = process.cwd(),
): Promise<void> {
  if (bootstrapped) {
    return;
  }

  const names = new Set(config.targets?.length ? config.targets : DEFAULT_TARGETS);
  for (const name of requested) {
    names.add(name);
  }

  for (const name of names) {
    if (isBuiltinTarget(name) || customFactories.has(name)) {
      continue;
    }
    const packageName = resolveTargetPackage(config, name);
    if (!packageName) {
      throw new Error(`Unknown target in targets[]: ${name}`);
    }
    const loaded = await loadTargetFromPackage(packageName, name, rootDir);
    customFactories.set(loaded.registryName, loaded.factory);
    if (loaded.hints) {
      customHints.set(loaded.registryName, loaded.hints);
    }
  }

  for (const name of names) {
    const factory = getTargetFactory(name);
    if (!factory) {
      throw new Error(`Unknown target in targets[]: ${name}`);
    }
    registerTarget(factory());
  }

  bootstrapped = true;
}

export function resetBootstrapTargets(): void {
  bootstrapped = false;
  customFactories.clear();
  customHints.clear();
  clearTargets();
}
