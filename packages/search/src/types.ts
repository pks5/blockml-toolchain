import type { Diagnostic } from "@blockml/bom";

export const INDEX_FORMAT_VERSION = 1;

export const DEFAULT_SEARCH_LIMIT = 10;

export const FIELD_BOOST = {
  fqn: 10,
  fqnText: 10,
  name: 8,
  aliases: 6,
  keywords: 6,
  documentation: 1,
} as const;

export interface SearchDocument {
  id: string;
  fqn: string;
  name: string;
  aliases: string[];
  keywords: string[];
  documentation: string;
  file: string;
  library?: string;
  type?: string;
  baseType?: string;
  idea?: string;
}

export interface SearchIndexOptions {
  rootDir?: string;
  srcDir?: string;
  libraries?: string[];
  indexDir?: string;
}

export interface SearchOptions extends SearchIndexOptions {
  limit?: number;
}

export interface SearchResult {
  fqn: string;
  name: string;
  file: string;
  score: number;
  library?: string;
}

export interface BuildIndexResult {
  index: SearchIndexHandle;
  diagnostics: Diagnostic[];
  documents: number;
}

export type IndexState = "missing" | "ready" | "stale";

export interface IndexStatus {
  state: IndexState;
  documents?: number;
  indexDir: string;
}

export interface SearchIndexHandle {
  readonly diagnostics: Diagnostic[];
  readonly documents: number;
  readonly filePaths: string[];
  search(query: string, options?: Pick<SearchOptions, "limit">): Promise<SearchResult[]>;
  serialize(): Promise<string>;
}
