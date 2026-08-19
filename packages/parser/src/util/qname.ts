import type { SourceLocation } from "@blockml/bom";

export const XSI_NS = "http://www.w3.org/2001/XMLSchema-instance";
export const BML_XMLNS = "http://blockml.org/bml";
export const TYPE_REFERENCE_ENTITY =
  "org.blockml.bml.type.TypeReferenceEntity";

const RELATION_TYPES: Record<string, string> = {
  Extends: "org.blockml.bml.relation.Extends",
  Defines: "org.blockml.bml.relation.Defines",
  AuthoringGuide: "org.blockml.bml.relation.AuthoringGuide",
  SeeAlso: "org.blockml.bml.relation.SeeAlso",
  BML: "org.blockml.bml.relation.BML",
};

export type ImplicitNamespaceContext =
  | "type"
  | "language"
  | "capability"
  | "status"
  | "validation"
  | "block"
  | "relation";

const PRIMITIVE_TYPES: Record<string, string> = {
  Float: "org.blockml.bml.type.Float",
  Integer: "org.blockml.bml.type.Integer",
  Boolean: "org.blockml.bml.type.Boolean",
  Decimal: "org.blockml.bml.type.Decimal",
  Text: "org.blockml.bml.type.Text",
  Color: "org.blockml.bml.type.Color",
  Entity: "org.blockml.bml.core.Entity",
  Block: "org.blockml.bml.core.Block",
  TypeReference: "org.blockml.bml.type.TypeReference",
  TypeReferenceEntity: "org.blockml.bml.type.TypeReferenceEntity",
  InstanceReference: "org.blockml.bml.type.InstanceReference",
  NaturalLanguage: "org.blockml.bml.language.NaturalLanguage",
};

const CAPABILITY_TYPES: Record<string, string> = {
  Inbound: "org.blockml.bml.capability.Inbound",
  Outbound: "org.blockml.bml.capability.Outbound",
  Transformation: "org.blockml.bml.capability.Transformation",
};

const LANGUAGE_TYPES: Record<string, string> = {
  TypeScript: "org.blockml.bml.language.TypeScript",
  OpenSCAD: "org.blockml.bml.language.OpenSCAD",
  English: "org.blockml.bml.language.English",
  ProgrammingLanguage: "org.blockml.bml.language.ProgrammingLanguage",
  BML: "org.blockml.bml.language.BML",
  Markdown: "org.blockml.bml.language.Markdown",
};

const STATUS_TYPES: Record<string, string> = {
  Draft: "org.blockml.bml.status.Draft",
  Stable: "org.blockml.bml.status.Stable",
  Deprecated: "org.blockml.bml.status.Deprecated",
};

export function splitQName(qname: string): { prefix: string; local: string } {
  const idx = qname.indexOf(":");
  if (idx === -1) {
    return { prefix: "", local: qname };
  }
  return { prefix: qname.slice(0, idx), local: qname.slice(idx + 1) };
}

export function resolvePrefix(
  prefix: string,
  bindings: Record<string, string>,
): string | undefined {
  if (prefix === "") {
    return "";
  }
  return bindings[prefix];
}

export function resolveBlockReference(
  qname: string,
  bindings: Record<string, string>,
  subBlockIndex: Map<string, string>,
  parentBlockType?: string,
): string {
  const { prefix, local } = splitQName(qname);
  if (prefix) {
    const ns = resolvePrefix(prefix, bindings);
    if (ns === undefined) {
      throw new Error(`BML_UNKNOWN_NAMESPACE_PREFIX: ${prefix}`);
    }
    return `${ns}.${local}`;
  }

  if (subBlockIndex.has(local)) {
    return subBlockIndex.get(local)!;
  }

  if (parentBlockType && /^[A-Z]/.test(local) && !local.includes(".")) {
    const candidate = `${parentBlockType}.${local}`;
    if ([...subBlockIndex.values()].includes(candidate)) {
      return candidate;
    }
    return candidate;
  }

  if (local.includes(".")) {
    const parts = local.split(".");
    const root = parts[0]!;
    if (subBlockIndex.has(local)) {
      return subBlockIndex.get(local)!;
    }
    if (parentBlockType) {
      const parentLocal = parentBlockType.split(".").pop();
      if (parentLocal === root && parts.length >= 2) {
        const nested = parts.slice(1).join(".");
        if (subBlockIndex.has(nested)) {
          return subBlockIndex.get(nested)!;
        }
      }
    }
  }

  if (/^[A-Z]/.test(local) && parentBlockType) {
    const candidate = `${parentBlockType}.${local}`;
    if (subBlockIndex.has(local)) {
      return subBlockIndex.get(local)!;
    }
    return candidate;
  }

  throw new Error(`BML_UNQUALIFIED_BLOCK_REFERENCE: ${qname}`);
}

export function resolveTypeName(
  name: string,
  bindings: Record<string, string>,
  context: ImplicitNamespaceContext = "type",
): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("BML_UNKNOWN_TYPE: empty");
  }

  if (trimmed === "bml:Self") {
    return "bml:Self";
  }

  const { prefix, local } = splitQName(trimmed);
  if (prefix) {
    const ns = resolvePrefix(prefix, bindings);
    if (ns === undefined) {
      throw new Error(`BML_UNKNOWN_NAMESPACE_PREFIX: ${prefix}`);
    }
    return `${ns}.${local}`;
  }

  const table =
    context === "capability"
      ? CAPABILITY_TYPES
      : context === "language"
        ? LANGUAGE_TYPES
        : context === "status"
          ? STATUS_TYPES
          : context === "relation"
            ? RELATION_TYPES
            : PRIMITIVE_TYPES;

  if (table[local]) {
    return table[local]!;
  }

  if (context === "relation" && /^[A-Z]/.test(local)) {
    return `org.blockml.bml.relation.${local}`;
  }

  if (trimmed.includes(".") && /^[a-z]/.test(trimmed.split(".")[0]!)) {
    return trimmed;
  }

  if (context === "type" && /^[A-Z]/.test(local)) {
    return `org.blockml.bml.type.${local}`;
  }

  throw new Error(`BML_UNKNOWN_TYPE: ${name}`);
}

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

  for (const [prefix, uri] of entries) {
    if (fqn.startsWith(`${uri}.`)) {
      return `${prefix}:${fqn.slice(uri.length + 1)}`;
    }
    if (fqn === uri) {
      return `${prefix}:${fqn.split(".").pop()}`;
    }
  }

  return fqn;
}

export function sourceLoc(
  file: string,
  source: string,
  search: string,
  occurrence = 0,
): SourceLocation {
  let idx = -1;
  let from = 0;
  for (let i = 0; i <= occurrence; i++) {
    idx = source.indexOf(search, from);
    if (idx === -1) {
      break;
    }
    from = idx + search.length;
  }
  if (idx === -1) {
    return { file, line: 1, column: 1 };
  }
  const before = source.slice(0, idx);
  const line = before.split("\n").length;
  const lastNl = before.lastIndexOf("\n");
  const column = idx - lastNl;
  return { file, line, column };
}

export function elementSourceLoc(
  file: string,
  source: string,
  tagName: string,
  occurrence = 0,
): SourceLocation {
  const patterns = [`<${tagName}`, `<${tagName} `, `<${tagName}>`];
  for (const pattern of patterns) {
    const loc = sourceLoc(file, source, pattern, occurrence);
    if (loc.line !== 1 || loc.column !== 1 || source.includes(pattern)) {
      return loc;
    }
  }
  return { file, line: 1, column: 1 };
}
