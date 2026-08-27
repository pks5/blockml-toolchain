import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";

export const CONFIG_FILE = "blockml.config.json";
export const DEFAULT_SRC_DIR = "blocks";

export function readJson(path: string): unknown | undefined {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
}

export function canonicalPath(path: string): string {
  const abs = resolve(path);
  try {
    return realpathSync(abs);
  } catch {
    return abs;
  }
}

/** srcDir for a package: blockml.config.json override, else default "blocks". */
export function packageSrcDir(packageDir: string): string {
  const configPath = join(packageDir, CONFIG_FILE);
  if (existsSync(configPath)) {
    const cfg = readJson(configPath) as { srcDir?: string } | undefined;
    if (typeof cfg?.srcDir === "string" && cfg.srcDir.length > 0) {
      return resolve(packageDir, cfg.srcDir);
    }
  }
  return resolve(packageDir, DEFAULT_SRC_DIR);
}

export function packageDeclaresLibrary(packageDir: string): boolean {
  const pkg = readJson(join(packageDir, "package.json")) as
    | { blockml?: { library?: string } }
    | undefined;
  const library = pkg?.blockml?.library;
  return typeof library === "string" && library.length > 0;
}

/** Blocks/srcDir root when the package is a BlockML module; otherwise undefined. */
export function blockmlPackageBlocksRoot(packageDir: string): string | undefined {
  const hasLibrary = packageDeclaresLibrary(packageDir);
  const hasConfig = existsSync(join(packageDir, CONFIG_FILE));
  if (!hasLibrary && !hasConfig) {
    return undefined;
  }
  return packageSrcDir(packageDir);
}
