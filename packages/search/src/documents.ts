import type { BlockDefinition, BomDocument, DocumentationProseEntry } from "@blockml/bom";
import type { TypeRegistry } from "@blockml/framework";
import type { SearchDocument } from "./types.js";

export function fqnToPackagePrefix(fqn: string): string {
  const segments = fqn.split(".");
  return segments.length > 1 ? segments.slice(0, -1).join(".") : fqn;
}

function proseText(entries: DocumentationProseEntry[] | undefined): string {
  if (!entries?.length) {
    return "";
  }
  return entries
    .map((entry) => entry.text.trim())
    .filter(Boolean)
    .join("\n");
}

export function blockToSearchDocument(
  block: BlockDefinition,
  filePath: string,
): SearchDocument | undefined {
  const fqn = block.type?.trim();
  const name = block.name?.trim();
  if (!fqn || !name) {
    return undefined;
  }

  const aliases = (block.aliases ?? [])
    .map((alias) => alias.name?.trim())
    .filter((value): value is string => Boolean(value));
  const keywords = (block.keywords ?? [])
    .map((keyword) => keyword.term?.trim())
    .filter((value): value is string => Boolean(value));
  const documentation = [proseText(block.documentations), proseText(block.summaries)]
    .filter(Boolean)
    .join("\n");

  const document: SearchDocument = {
    id: fqn,
    fqn,
    name,
    aliases,
    keywords,
    documentation,
    file: filePath,
    library: fqnToPackagePrefix(fqn),
    type: fqn,
  };
  if (block.baseType) {
    document.baseType = block.baseType;
  }
  if (block.is) {
    document.idea = block.is;
  }
  return document;
}

export function documentsFromRegistry(registry: TypeRegistry): SearchDocument[] {
  const documents: SearchDocument[] = [];
  const seen = new Set<string>();
  for (const fqn of registry.keys()) {
    const doc: BomDocument | undefined = registry.get(fqn);
    if (!doc?.block) {
      continue;
    }
    const mapped = blockToSearchDocument(doc.block, doc.source?.filePath ?? fqn);
    if (!mapped || seen.has(mapped.fqn)) {
      continue;
    }
    seen.add(mapped.fqn);
    documents.push(mapped);
  }
  documents.sort((a, b) => a.fqn.localeCompare(b.fqn));
  return documents;
}
