import type { SearchIndexEntry } from "./search-index.js";
export declare const TOOLBAR_CSS: string;
export declare const PAGE_SHELL_CSS: string;
export declare function renderToolbar(pagePath: string, rootIndexPath: string): string;
export declare function wrapHtmlDocument(title: string, pagePath: string, rootIndexPath: string, css: string, bodyInner: string): string;
export declare function renderSearchScript(entries: SearchIndexEntry[]): string;
//# sourceMappingURL=toolbar.d.ts.map