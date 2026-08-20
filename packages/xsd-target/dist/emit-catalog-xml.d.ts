export interface CatalogEntry {
    namespaceUri: string;
    relativePath: string;
}
export declare function catalogRelativePath(outDir: string, schemaFileName: string): string;
export declare function emitCatalogXml(entries: CatalogEntry[]): string;
//# sourceMappingURL=emit-catalog-xml.d.ts.map