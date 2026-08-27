import type { Diagnostic } from "@blockml/bom";
import { SearchIndex } from "./orama-index.js";
import type { BuildIndexResult, IndexStatus, SearchDocument, SearchIndexHandle, SearchIndexOptions, SearchOptions, SearchResult } from "./types.js";
export type { BuildIndexResult, IndexState, IndexStatus, SearchDocument, SearchIndexHandle, SearchIndexOptions, SearchOptions, SearchResult, } from "./types.js";
export { SearchIndex } from "./orama-index.js";
export { blockToSearchDocument, documentsFromRegistry, fqnToPackagePrefix } from "./documents.js";
export { defaultIndexDir, resolveIndexDir } from "./fingerprint.js";
export declare function buildMemoryIndex(documents: SearchDocument[], diagnostics?: Diagnostic[]): Promise<SearchIndex>;
export declare function buildIndex(options?: SearchIndexOptions): Promise<BuildIndexResult>;
export declare function saveIndex(index: SearchIndexHandle, options?: SearchIndexOptions): Promise<void>;
export declare function loadIndex(options?: SearchIndexOptions): Promise<SearchIndex | undefined>;
export declare function rebuildIndex(options?: SearchIndexOptions): Promise<BuildIndexResult>;
export declare function getIndexStatus(options?: SearchIndexOptions): Promise<IndexStatus>;
export declare function openIndex(options?: SearchIndexOptions): Promise<BuildIndexResult>;
export declare function search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
//# sourceMappingURL=index.d.ts.map