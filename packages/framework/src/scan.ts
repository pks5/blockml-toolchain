import type { TypeRegistry } from "./registry/type-registry.js";
import {
  evaluateCapability,
  evaluateParseValue,
} from "./validate/evaluate-parse-value.js";

const PACKAGE_SELECTOR = "org.blockml.bml.type.PackageSelector";
const TYPE_SELECTOR = "org.blockml.bml.type.TypeSelector";
const TYPE_EXPR_CHARS = /[(){}[\]|<>,:]/;
const PACKAGE_IDENTIFIER = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/;

export type ScanResult =
  | { ok: true; hits: string[] }
  | { ok: false; message: string };

function parseSelectorList(
  selectorType: string,
  selectors: string[],
  registry: TypeRegistry,
): { ok: true; selectors: string[] } | { ok: false; message: string } {
  const parsed: string[] = [];
  for (const raw of selectors) {
    const result = evaluateParseValue(selectorType, raw, registry);
    if (!result.ok) {
      return { ok: false, message: result.message };
    }
    if ("skipped" in result) {
      return { ok: false, message: `could not parse selector: ${raw}` };
    }
    parsed.push(String(result.value));
  }
  return { ok: true, selectors: parsed };
}

function matchesAny(
  selectorType: string,
  selectors: string[],
  candidate: string,
  registry: TypeRegistry,
): boolean {
  return selectors.some((selector) => {
    const result = evaluateCapability(selectorType, "matches", [selector, candidate], registry);
    return result.ok && !("skipped" in result) && result.value === true;
  });
}

export function typeCandidates(registry: TypeRegistry): string[] {
  return registry.keys().filter((fqn) => Boolean(fqn) && !TYPE_EXPR_CHARS.test(fqn)).sort();
}

export function packageCandidates(registry: TypeRegistry): string[] {
  const packages = new Set<string>();
  for (const fqn of registry.keys()) {
    if (!fqn || TYPE_EXPR_CHARS.test(fqn)) {
      continue;
    }
    const segments = fqn.split(".");
    for (let i = 2; i < segments.length; i++) {
      const pkg = segments.slice(0, i).join(".");
      if (PACKAGE_IDENTIFIER.test(pkg)) {
        packages.add(pkg);
      }
    }
  }
  return [...packages].sort();
}

function scan(
  selectorType: string,
  selectors: string[],
  candidates: string[],
  registry: TypeRegistry,
): ScanResult {
  const parsed = parseSelectorList(selectorType, selectors, registry);
  if (!parsed.ok) {
    return parsed;
  }
  const hits = candidates.filter((candidate) =>
    matchesAny(selectorType, parsed.selectors, candidate, registry),
  );
  return { ok: true, hits };
}

export function scanTypes(selectors: string[], registry: TypeRegistry): ScanResult {
  return scan(TYPE_SELECTOR, selectors, typeCandidates(registry), registry);
}

export function scanPackages(selectors: string[], registry: TypeRegistry): ScanResult {
  return scan(PACKAGE_SELECTOR, selectors, packageCandidates(registry), registry);
}
