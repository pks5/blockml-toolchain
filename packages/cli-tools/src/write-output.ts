import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { RenderOutput } from "@blockml/compiler";

export interface WriteOutputOptions {
  cleanOutDir?: boolean;
}

export function writeOutputFiles(
  output: RenderOutput,
  outDir: string,
  rootDir = process.cwd(),
  options: WriteOutputOptions = {},
): void {
  const base = resolve(rootDir, outDir);
  if (options.cleanOutDir) {
    rmSync(base, { recursive: true, force: true });
  }
  for (const file of output.files) {
    const targetPath = join(base, file.path);
    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, file.content, "utf8");
  }
}
