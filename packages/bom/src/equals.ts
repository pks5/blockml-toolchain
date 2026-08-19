import type { BomDocument } from "./types/document.js";

function isSourceLocation(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj["file"] === "string" &&
    typeof obj["line"] === "number" &&
    typeof obj["column"] === "number"
  );
}

function isSourceInfo(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return obj["format"] === "xml" && typeof obj["filePath"] === "string";
}

/**
 * Deep-clone a value tree omitting provenance keys recursively (B20).
 * Removes SourceInfo, SourceLocation spans, and optional endLine/endColumn —
 * but preserves ImplementationBlock.source (implementation code body).
 */
export function stripProvenance<T>(node: T): T {
  if (node === null || node === undefined) {
    return node;
  }

  if (Array.isArray(node)) {
    return node.map((item) => stripProvenance(item)) as T;
  }

  if (typeof node !== "object") {
    return node;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === "sourceLocation" || key === "endLine" || key === "endColumn") {
      continue;
    }
    if (key === "source" && (isSourceLocation(value) || isSourceInfo(value))) {
      continue;
    }
    result[key] = stripProvenance(value);
  }
  return result as T;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }

  if (a === null || b === null || a === undefined || b === undefined) {
    return a === b;
  }

  if (typeof a !== typeof b) {
    return false;
  }

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) {
        return false;
      }
    }
    return true;
  }

  if (typeof a === "object") {
    if (typeof b !== "object" || Array.isArray(b)) {
      return false;
    }

    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj).sort();
    const bKeys = Object.keys(bObj).sort();

    if (aKeys.length !== bKeys.length) {
      return false;
    }

    for (let i = 0; i < aKeys.length; i++) {
      const key = aKeys[i];
      const bKey = bKeys[i];
      if (key === undefined || bKey === undefined || key !== bKey) {
        return false;
      }
      if (!deepEqual(aObj[key], bObj[bKey])) {
        return false;
      }
    }
    return true;
  }

  return false;
}

/** Structural equality modulo provenance (B20). */
export function bomEquals(a: BomDocument, b: BomDocument): boolean {
  return deepEqual(stripProvenance(a), stripProvenance(b));
}
