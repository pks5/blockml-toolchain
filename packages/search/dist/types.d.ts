import type { Diagnostic } from "@blockml/bom";
export declare const INDEX_FORMAT_VERSION = 1;
export declare const DEFAULT_SEARCH_LIMIT = 10;
export declare const FIELD_BOOST: {
    readonly fqn: 10;
    readonly fqnText: 10;
    readonly name: 8;
    readonly aliases: 6;
    readonly keywords: 6;
    readonly documentation: 1;
};
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
//# sourceMappingURL=types.d.ts.map