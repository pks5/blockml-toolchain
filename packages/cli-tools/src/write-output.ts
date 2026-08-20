import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { RenderOutput, RenderOutputFile } from "@blockml/compiler";

export interface WriteOutputOptions {
  cleanOutDir?: boolean;
  rootFiles?: RenderOutputFile[];
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
  for (const file of options.rootFiles ?? []) {
    const targetPath = join(resolve(rootDir), file.path);
    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, file.content, "utf8");
  }
}
