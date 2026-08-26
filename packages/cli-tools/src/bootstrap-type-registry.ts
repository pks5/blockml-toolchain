import {
  bootstrapTypeRegistry,
  resolveLibrarySeeds,
  type BootstrapResult,
} from "@blockml/framework";
import type { BomConfig } from "./load-config.js";

export interface CliBootstrapOptions {
  config: BomConfig;
  rootDir?: string;
  librariesOverride?: string[];
  srcDirOverride?: string;
}

export function projectLibrarySeeds(
  options: Pick<CliBootstrapOptions, "config" | "rootDir" | "librariesOverride">,
): string[] {
  const rootDir = options.rootDir ?? process.cwd();
  const extras = options.librariesOverride ?? options.config.libraries ?? [];
  return resolveLibrarySeeds(rootDir, extras);
}

export function bootstrapProjectTypeRegistry(
  options: CliBootstrapOptions,
): BootstrapResult {
  const rootDir = options.rootDir ?? process.cwd();
  const srcDir = options.srcDirOverride ?? options.config.srcDir ?? "blocks";
  const libraries = projectLibrarySeeds(options);

  const bootstrapOptions: {
    libraryPaths?: string[];
    paths?: string[];
    rootDir: string;
  } = { rootDir, paths: [srcDir] };
  if (libraries.length > 0) {
    bootstrapOptions.libraryPaths = libraries;
  }

  return bootstrapTypeRegistry(bootstrapOptions);
}
