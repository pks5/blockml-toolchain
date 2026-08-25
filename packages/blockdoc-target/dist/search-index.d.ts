import type { BlockDefinition } from "@blockml/bom";
export interface SearchIndexEntry {
    name: string;
    type: string;
    is?: string;
    href: string;
    keywords: string[];
}
export interface SearchIndex {
    blocks: SearchIndexEntry[];
}
export declare function collectKeywords(block: BlockDefinition): string[];
export declare function buildSearchIndexEntry(block: BlockDefinition, href: string): SearchIndexEntry;
export declare function serializeSearchIndex(entries: SearchIndexEntry[]): string;
export declare function filterSearchIndex(entries: SearchIndexEntry[], query: string, limit?: number): SearchIndexEntry[];
//# sourceMappingURL=search-index.d.ts.map