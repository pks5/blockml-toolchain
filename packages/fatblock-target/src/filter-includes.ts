export function matchesIncludePattern(fqn: string, pattern: string): boolean {
  if (pattern.endsWith("*")) {
    const prefix = pattern.slice(0, -1);
    return fqn.startsWith(prefix);
  }
  return fqn === pattern;
}

export function filterByIncludes(fqns: string[], patterns?: string[]): string[] {
  if (!patterns?.length) {
    return fqns;
  }
  return fqns.filter((fqn) =>
    patterns.some((pattern) => matchesIncludePattern(fqn, pattern.trim())),
  );
}
