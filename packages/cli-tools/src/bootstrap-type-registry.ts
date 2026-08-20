import { bootstrapTypeRegistry, type BootstrapResult } from "@blockml/framework";
import type { BomConfig } from "./load-config.js";

export interface CliBootstrapOptions {
  config: BomConfig;
  rootDir?: string;
  librariesOverride?: string[];
  srcDirOverride?: string;
}

export function bootstrapProjectTypeRegistry(
  options: CliBootstrapOptions,
): BootstrapResult {
  const rootDir = options.rootDir ?? process.cwd();
  const srcDir = options.srcDirOverride ?? options.config.srcDir ?? "src";
  const libraries = options.librariesOverride ?? options.config.libraries ?? [];

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
