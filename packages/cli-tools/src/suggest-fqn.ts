import { bootstrapFullProjectRegistry, rootFqnByFilePath } from "@blockml/framework";
import { search } from "@blockml/search";
import { realpathSync } from "node:fs";
import { basename, isAbsolute, relative, resolve, sep } from "node:path";

const MIN_NAME_LENGTH = 3;

export interface SuggestFqnOptions {
  rootDir: string;
  srcDir?: string;
  libraries?: string[];
}

function lastSegment(fqn: string): string {
  const parts = fqn.split(".");
  return parts[parts.length - 1] || fqn;
}

function looksLikeFilePath(input: string): boolean {
  return /[\\/]/.test(input) || /\.bml$/i.test(input);
}

function blockFileStem(input: string): string {
  return basename(input).replace(/\.bml$/i, "");
}

function canonicalize(path: string): string {
  const abs = resolve(path);
  try {
    return realpathSync(abs);
  } catch {
    return abs;
  }
}

function posixRelative(from: string, to: string): string {
  return relative(from, to).split(sep).join("/");
}

function posixInput(input: string): string {
  return input.replaceAll("\\", "/").replace(/^\.\//, "");
}

function fqnForFilePath(
  input: string,
  rootDir: string,
  byFile: Map<string, string>,
): string | undefined {
  const fromRoot = canonicalize(isAbsolute(input) ? input : resolve(rootDir, input));
  const fromCwd = canonicalize(resolve(input));
  const relInput = posixInput(input);
  const exact = new Set<string>();
  const suffix = new Set<string>();

  for (const [file, fqn] of byFile) {
    const fileCanon = canonicalize(file);
    if (fileCanon === fromRoot || fileCanon === fromCwd) {
      exact.add(fqn);
      continue;
    }
    const rel = posixRelative(rootDir, fileCanon);
    if (rel === relInput) {
      exact.add(fqn);
      continue;
    }
    if (relInput.includes("/")) {
      if (rel.endsWith(`/${relInput}`)) {
        suffix.add(fqn);
      }
      continue;
    }
    if (basename(fileCanon).toLowerCase() === relInput.toLowerCase()) {
      suffix.add(fqn);
    }
  }

  if (exact.size === 1) {
    return [...exact][0];
  }
  if (exact.size > 1) {
    return undefined;
  }
  if (suffix.size === 1) {
    return [...suffix][0];
  }
  return undefined;
}

function suggestFromFilePath(unknownFqn: string, options: SuggestFqnOptions): string | undefined {
  if (!looksLikeFilePath(unknownFqn)) {
    return undefined;
  }
  try {
    const bootstrap = bootstrapFullProjectRegistry({
      rootDir: options.rootDir,
      ...(options.srcDir !== undefined ? { srcDir: options.srcDir } : {}),
      ...(options.libraries !== undefined ? { libraries: options.libraries } : {}),
    });
    const fqn = fqnForFilePath(unknownFqn, options.rootDir, rootFqnByFilePath(bootstrap.registry));
    return fqn && fqn !== unknownFqn ? fqn : undefined;
  } catch {
    return undefined;
  }
}

function searchNeedle(unknownFqn: string): string {
  if (looksLikeFilePath(unknownFqn)) {
    return blockFileStem(unknownFqn).trim();
  }
  return lastSegment(unknownFqn).trim();
}

export async function suggestMatchingFqn(
  unknownFqn: string,
  options: SuggestFqnOptions,
): Promise<string | undefined> {
  const fromFile = suggestFromFilePath(unknownFqn, options);
  if (fromFile) {
    return fromFile;
  }

  const needle = searchNeedle(unknownFqn);
  if (needle.length < MIN_NAME_LENGTH) {
    return undefined;
  }
  try {
    const hits = await search(needle, {
      rootDir: options.rootDir,
      ...(options.srcDir !== undefined ? { srcDir: options.srcDir } : {}),
      ...(options.libraries !== undefined ? { libraries: options.libraries } : {}),
      limit: 5,
    });
    const needleLower = needle.toLowerCase();
    const hit = hits.find((entry) => {
      if (entry.fqn === unknownFqn) {
        return false;
      }
      const name = lastSegment(entry.fqn);
      return name.toLowerCase() === needleLower || entry.name.toLowerCase() === needleLower;
    });
    return hit?.fqn;
  } catch {
    return undefined;
  }
}

export function unknownFqnMessage(fqn: string, suggestion?: string): string {
  const base = `Unknown Block FQN: ${fqn}.`;
  return suggestion ? `${base} Did you mean ${suggestion}?` : base;
}
