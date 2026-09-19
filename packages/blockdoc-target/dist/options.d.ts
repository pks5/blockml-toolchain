export interface BlockDocOptions {
    /** default: "merged" — one site for all libraries in scope */
    siteMode?: "merged" | "perLibrary";
    /** URL path layout under outDir — default: "fqn" */
    outLayout?: "fqn" | "package";
    /** when false, only location-based library members; when true, all .bml under roots */
    includeNonExported?: boolean;
}
export declare const DEFAULT_BLOCKDOC_OPTIONS: Required<BlockDocOptions>;
export declare function resolveBlockDocOptions(targetOptions?: unknown): Required<BlockDocOptions>;
//# sourceMappingURL=options.d.ts.map