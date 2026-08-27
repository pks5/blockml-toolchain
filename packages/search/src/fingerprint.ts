import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { projectSourceRoots } from "@blockml/framework";
import { INDEX_FORMAT_VERSION } from "./types.js";

export const ORAMA_FILE = "orama.json";
export const MANIFEST_FILE = "manifest.json";

export interface FileFingerprint {
  path: string;
  mtimeMs: number;
  size: number;
}

export interface IndexManifest {
  version: number;
  documents: number;
  packageJsonHash: string;
  lockfileHash: string;
  files: FileFingerprint[];
}

export function defaultIndexDir(rootDir: string): string {
  return join(rootDir, ".blockml", "search");
}

export function resolveIndexDir(rootDir: string, indexDir?: string): string {
  return indexDir ? resolve(rootDir, indexDir) : defaultIndexDir(rootDir);
}

function hashFileOrEmpty(path: string): string {
  if (!existsSync(path)) {
    return "";
  }
  try {
    return createHash("sha256").update(readFileSync(path)).digest("hex");
  } catch {
    return "";
  }
}

function lockfilePath(rootDir: string): string {
  const lock = join(rootDir, "package-lock.json");
  if (existsSync(lock)) {
    return lock;
  }
  return join(rootDir, "npm-shrinkwrap.json");
}

export function fingerprintProject(rootDir: string): {
  packageJsonHash: string;
  lockfileHash: string;
} {
  return {
    packageJsonHash: hashFileOrEmpty(join(rootDir, "package.json")),
    lockfileHash: hashFileOrEmpty(lockfilePath(rootDir)),
  };
}

export function fingerprintFiles(filePaths: string[]): FileFingerprint[] {
  const unique = [...new Set(filePaths)].sort();
  const files: FileFingerprint[] = [];
  for (const filePath of unique) {
    try {
      const st = statSync(filePath);
      files.push({ path: filePath, mtimeMs: st.mtimeMs, size: st.size });
    } catch {
      files.push({ path: filePath, mtimeMs: 0, size: 0 });
    }
  }
  return files;
}

function collectBmlFiles(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    try {
      const st = statSync(full);
      if (st.isDirectory()) {
        collectBmlFiles(full, out);
      } else if (entry.endsWith(".bml")) {
        out.push(full);
      }
    } catch {
      continue;
    }
  }
  return out;
}

function fingerprintsEqual(a: FileFingerprint[], b: FileFingerprint[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    const left = a[i]!;
    const right = b[i]!;
    if (left.path !== right.path || left.mtimeMs !== right.mtimeMs || left.size !== right.size) {
      return false;
    }
  }
  return true;
}

export function buildManifest(rootDir: string, filePaths: string[], documents: number): IndexManifest {
  const hashes = fingerprintProject(rootDir);
  return {
    version: INDEX_FORMAT_VERSION,
    documents,
    packageJsonHash: hashes.packageJsonHash,
    lockfileHash: hashes.lockfileHash,
    files: fingerprintFiles(filePaths),
  };
}

export function manifestIsCurrent(
  manifest: IndexManifest,
  rootDir: string,
  srcDir?: string,
): boolean {
  if (manifest.version !== INDEX_FORMAT_VERSION) {
    return false;
  }
  const hashes = fingerprintProject(rootDir);
  if (
    hashes.packageJsonHash !== manifest.packageJsonHash ||
    hashes.lockfileHash !== manifest.lockfileHash
  ) {
    return false;
  }

  const currentIndexed = fingerprintFiles(manifest.files.map((file) => file.path));
  if (!fingerprintsEqual(currentIndexed, manifest.files)) {
    return false;
  }

  const localFiles = new Set<string>();
  for (const root of projectSourceRoots(rootDir, srcDir)) {
    for (const file of collectBmlFiles(root)) {
      localFiles.add(resolve(file));
    }
  }
  const indexedLocal = new Set(
    manifest.files.map((file) => resolve(file.path)).filter((path) => localFiles.has(path)),
  );
  if (localFiles.size !== indexedLocal.size) {
    return false;
  }
  for (const file of localFiles) {
    if (!indexedLocal.has(file)) {
      return false;
    }
  }
  return true;
}

export function readManifest(indexDir: string): IndexManifest | undefined {
  const path = join(indexDir, MANIFEST_FILE);
  if (!existsSync(path)) {
    return undefined;
  }
  try {
    return JSON.parse(readFileSync(path, "utf8")) as IndexManifest;
  } catch {
    return undefined;
  }
}
