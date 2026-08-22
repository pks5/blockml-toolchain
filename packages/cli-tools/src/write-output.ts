import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { RenderOutput, RenderOutputFile } from "@blockml/compiler";

export interface WriteOutputOptions {
  cleanOutDir?: boolean;
  /** Legacy override; prefer output.rootFiles from RenderOutput. */
  rootFiles?: RenderOutputFile[];
}

export interface WriteOutputResult {
  filesWritten: number;
  rootFilesWritten: string[];
}

export function writeOutputFiles(
  output: RenderOutput,
  outDir: string,
  rootDir = process.cwd(),
  options: WriteOutputOptions = {},
): WriteOutputResult {
  const base = resolve(rootDir, outDir);
  if (options.cleanOutDir) {
    rmSync(base, { recursive: true, force: true });
  }
  for (const file of output.files) {
    const targetPath = join(base, file.path);
    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, file.content, "utf8");
  }

  const rootFiles = options.rootFiles ?? output.rootFiles ?? [];
  const rootFilesWritten: string[] = [];
  for (const file of rootFiles) {
    const targetPath = join(resolve(rootDir), file.path);
    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, file.content, "utf8");
    rootFilesWritten.push(file.path);
  }

  return {
    filesWritten: output.files.length,
    rootFilesWritten,
  };
}
