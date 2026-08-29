import { create, getByID, insertMultiple, search as oramaSearch, type AnyOrama } from "@orama/orama";
import { persist, restore } from "@orama/plugin-data-persistence";
import type { Diagnostic } from "@blockml/bom";
import type { SearchDocument, SearchIndexHandle, SearchOptions, SearchResult } from "./types.js";
import { DEFAULT_SEARCH_LIMIT, FIELD_BOOST } from "./types.js";

const SCHEMA = {
  id: "string",
  fqn: "string",
  fqnText: "string",
  name: "string",
  aliases: "string[]",
  keywords: "string[]",
  documentation: "string",
  file: "string",
  library: "string",
  type: "string",
  baseType: "string",
  idea: "string",
} as const;

interface IndexedDocument {
  id: string;
  fqn: string;
  fqnText: string;
  name: string;
  aliases: string[];
  keywords: string[];
  documentation: string;
  file: string;
  library: string;
  type: string;
  baseType: string;
  idea: string;
}

function toIndexed(document: SearchDocument): IndexedDocument {
  return {
    id: document.id,
    fqn: document.fqn,
    fqnText: document.fqn.replaceAll(".", " "),
    name: document.name,
    aliases: document.aliases,
    keywords: document.keywords,
    documentation: document.documentation,
    file: document.file,
    library: document.library ?? "",
    type: document.type ?? document.fqn,
    baseType: document.baseType ?? "",
    idea: document.idea ?? "",
  };
}

function hitToResult(hit: { score: number; document: IndexedDocument }): SearchResult {
  const result: SearchResult = {
    fqn: hit.document.fqn,
    name: hit.document.name,
    file: hit.document.file,
    score: hit.score,
  };
  if (hit.document.library) {
    result.library = hit.document.library;
  }
  return result;
}

function compareResults(a: SearchResult, b: SearchResult): number {
  return b.score - a.score || a.fqn.localeCompare(b.fqn);
}

function uniqueFilePaths(documents: SearchDocument[]): string[] {
  return [...new Set(documents.map((document) => document.file).filter(Boolean))].sort();
}

export class SearchIndex implements SearchIndexHandle {
  readonly diagnostics: Diagnostic[];
  readonly documents: number;
  readonly filePaths: string[];
  private readonly db: AnyOrama;

  constructor(
    db: AnyOrama,
    documents: number,
    filePaths: string[],
    diagnostics: Diagnostic[] = [],
  ) {
    this.db = db;
    this.documents = documents;
    this.filePaths = filePaths;
    this.diagnostics = diagnostics;
  }

  async search(query: string, options?: Pick<SearchOptions, "limit">): Promise<SearchResult[]> {
    const term = query.trim();
    if (!term) {
      return [];
    }
    const limit = options?.limit ?? DEFAULT_SEARCH_LIMIT;
    const exactDoc = getByID(this.db, term) as IndexedDocument | null | undefined;
    const result = await oramaSearch(this.db, {
      term,
      limit,
      boost: { ...FIELD_BOOST },
      properties: ["fqn", "fqnText", "name", "aliases", "keywords", "documentation"],
    });
    const hits = result.hits as unknown as Array<{ score: number; document: IndexedDocument }>;
    const ranked = hits.map((hit) => hitToResult(hit)).sort(compareResults);
    if (!exactDoc) {
      return ranked.slice(0, limit);
    }
    const others = ranked.filter((hit) => hit.fqn !== exactDoc.fqn);
    const bm25Exact = ranked.find((hit) => hit.fqn === exactDoc.fqn);
    const topOtherScore = others[0]?.score ?? 0;
    const exactScore = Math.max(bm25Exact?.score ?? 0, topOtherScore) + 1;
    return [hitToResult({ score: exactScore, document: exactDoc }), ...others].slice(0, limit);
  }

  async serialize(): Promise<string> {
    const payload = await persist(this.db, "json");
    return typeof payload === "string" ? payload : String(payload);
  }
}

export async function createSearchIndex(
  documents: SearchDocument[],
  diagnostics: Diagnostic[] = [],
): Promise<SearchIndex> {
  const db = await create({ schema: SCHEMA });
  if (documents.length > 0) {
    await insertMultiple(
      db,
      documents.map((document) => toIndexed(document)),
    );
  }
  return new SearchIndex(db, documents.length, uniqueFilePaths(documents), diagnostics);
}

export async function restoreSearchIndex(
  serialized: string,
  documents: number,
  filePaths: string[],
  diagnostics: Diagnostic[] = [],
): Promise<SearchIndex> {
  const db = await restore("json", serialized);
  return new SearchIndex(db, documents, filePaths, diagnostics);
}
