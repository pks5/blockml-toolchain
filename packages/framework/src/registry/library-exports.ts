import { resolve } from "node:path";
import type { BootstrapResult } from "./bootstrap.js";

/** Exported block FQNs for a library path from a library-mode bootstrap. */
export function getExportedFqns(
  libraryPath: string,
  bootstrap: BootstrapResult,
  rootDir = process.cwd(),
): Set<string> | undefined {
  if (!bootstrap.exportsByLibrary) {
    return undefined;
  }
  const abs = resolve(rootDir, libraryPath);
  return bootstrap.exportsByLibrary.get(abs);
}
