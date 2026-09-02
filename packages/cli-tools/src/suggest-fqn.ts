import { search } from "@blockml/search";

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

export async function suggestMatchingFqn(
  unknownFqn: string,
  options: SuggestFqnOptions,
): Promise<string | undefined> {
  const needle = lastSegment(unknownFqn).trim();
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
