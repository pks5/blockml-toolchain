import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export interface BomConfig {
  outDir?: string;
  srcDir?: string;
  libraries?: string[];
  targets?: string[];
  /** Registry name → npm package for dynamic target plugin loading. */
  targetPackages?: Record<string, string>;
  targetOptions?: Record<string, unknown>;
  /** Default compile target when omitted on CLI. Default "blockdoc". */
  defaultTarget?: string;
}

const DEFAULT_CONFIG: Required<Pick<BomConfig, "outDir" | "srcDir" | "targets" | "defaultTarget">> = {
  outDir: "doc",
  srcDir: "src",
  targets: ["blockdoc"],
  defaultTarget: "blockdoc",
};

export function loadConfig(cwd = process.cwd()): BomConfig {
  const configPath = resolve(cwd, "bom.config.json");
  if (!existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }
  const raw = readFileSync(configPath, "utf8");
  const parsed = JSON.parse(raw) as BomConfig;
  return {
    ...DEFAULT_CONFIG,
    ...parsed,
    targets: parsed.targets?.length ? parsed.targets : DEFAULT_CONFIG.targets,
    defaultTarget: parsed.defaultTarget ?? DEFAULT_CONFIG.defaultTarget,
  };
}
