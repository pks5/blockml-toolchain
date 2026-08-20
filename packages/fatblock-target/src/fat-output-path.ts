import { basename } from "node:path";

export function fatOutputBasename(hostFilePath: string): string {
  const base = basename(hostFilePath);
  if (base.endsWith(".bml")) {
    return `${base.slice(0, -4)}.fat.bml`;
  }
  return `${base}.fat.bml`;
}
