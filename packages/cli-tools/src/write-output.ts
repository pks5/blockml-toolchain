import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { RenderOutput } from "@blockml/compiler";

export function writeOutputFiles(output: RenderOutput, outDir: string, rootDir = process.cwd()): void {
  const base = resolve(rootDir, outDir);
  for (const file of output.files) {
    const targetPath = join(base, file.path);
    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, file.content, "utf8");
  }
}
