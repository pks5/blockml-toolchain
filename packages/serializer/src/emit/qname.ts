import { XSI_NS, BML_XMLNS } from "./constants.js";

export { XSI_NS, BML_XMLNS };

export function hasBmlSemanticQNameBindings(
  bindings: Record<string, string>,
): boolean {
  for (const [prefix, uri] of Object.entries(bindings)) {
    if (prefix === "" || uri === XSI_NS || uri === BML_XMLNS) {
      continue;
    }
    return true;
  }
  return false;
}

export function fqnToQName(
  fqn: string,
  bindings: Record<string, string>,
): string {
  const entries = Object.entries(bindings).filter(
    ([prefix, uri]) => prefix !== "" && uri !== XSI_NS && uri !== BML_XMLNS,
  );

  let bestPrefix: string | undefined;
  let bestUri = "";
  for (const [prefix, uri] of entries) {
    const dotPrefix = `${uri}.`;
    if (fqn.startsWith(dotPrefix) && uri.length > bestUri.length) {
      bestPrefix = prefix;
      bestUri = uri;
    }
  }
  if (bestPrefix !== undefined) {
    return `${bestPrefix}:${fqn.slice(bestUri.length + 1)}`;
  }

  return fqn;
}

export function qnameToParts(qname: string): { prefix: string; local: string } {
  const idx = qname.indexOf(":");
  if (idx === -1) {
    return { prefix: "", local: qname };
  }
  return { prefix: qname.slice(0, idx), local: qname.slice(idx + 1) };
}

export function visibilityPrefix(
  visibility: "private" | "protected" | "public" | undefined,
): string {
  switch (visibility) {
    case "private":
      return "__";
    case "protected":
      return "_";
    default:
      return "";
  }
}
