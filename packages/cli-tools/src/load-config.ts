import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export interface BomConfig {
  outDir?: string;
  srcDir?: string;
  libraries?: string[];
  targets?: string[];
  targetOptions?: Record<string, unknown>;
  /** Default true when unset. Set false to skip authoring XSD validation on validate. */
  xsdValidation?: boolean;
}

const DEFAULT_CONFIG: Required<Pick<BomConfig, "outDir" | "srcDir" | "targets">> & {
  xsdValidation: boolean;
} = {
  outDir: "doc",
  srcDir: "src",
  targets: ["blockdoc"],
  xsdValidation: true,
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
    xsdValidation: parsed.xsdValidation ?? DEFAULT_CONFIG.xsdValidation,
  };
}
