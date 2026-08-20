import type { Diagnostic } from "@blockml/bom";

export interface MergeNamespaceResult {
  bindings: Record<string, string>;
  diagnostics: Diagnostic[];
}

export function mergeNamespaceBindings(
  sources: Array<{ file: string; bindings?: Record<string, string> }>,
): MergeNamespaceResult {
  const merged: Record<string, string> = {};
  const diagnostics: Diagnostic[] = [];

  for (const source of sources) {
    const bindings = source.bindings ?? { "": "http://blockml.org/bml" };
    for (const [prefix, uri] of Object.entries(bindings)) {
      const existing = merged[prefix];
      if (existing !== undefined && existing !== uri) {
        diagnostics.push({
          severity: "error",
          code: "BML_NAMESPACE_PREFIX_COLLISION",
          message: `Prefix "${prefix || "(default)"}" maps to both ${existing} and ${uri}`,
          source: { file: source.file, line: 1, column: 1 },
        });
      } else if (existing === undefined) {
        merged[prefix] = uri;
      }
    }
  }

  return { bindings: merged, diagnostics };
}
