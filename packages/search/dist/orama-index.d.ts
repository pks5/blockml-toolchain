import { type AnyOrama } from "@orama/orama";
import type { Diagnostic } from "@blockml/bom";
import type { SearchDocument, SearchIndexHandle, SearchOptions, SearchResult } from "./types.js";
export declare class SearchIndex implements SearchIndexHandle {
    readonly diagnostics: Diagnostic[];
    readonly documents: number;
    readonly filePaths: string[];
    private readonly db;
    constructor(db: AnyOrama, documents: number, filePaths: string[], diagnostics?: Diagnostic[]);
    search(query: string, options?: Pick<SearchOptions, "limit">): Promise<SearchResult[]>;
    serialize(): Promise<string>;
}
export declare function createSearchIndex(documents: SearchDocument[], diagnostics?: Diagnostic[]): Promise<SearchIndex>;
export declare function restoreSearchIndex(serialized: string, documents: number, filePaths: string[], diagnostics?: Diagnostic[]): Promise<SearchIndex>;
//# sourceMappingURL=orama-index.d.ts.map