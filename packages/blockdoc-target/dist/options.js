export const DEFAULT_BLOCKDOC_OPTIONS = {
    siteMode: "merged",
    outLayout: "fqn",
    includeNonExported: true,
};
export function resolveBlockDocOptions(targetOptions) {
    const opts = (targetOptions ?? {});
    return {
        siteMode: opts.siteMode ?? DEFAULT_BLOCKDOC_OPTIONS.siteMode,
        outLayout: opts.outLayout ?? DEFAULT_BLOCKDOC_OPTIONS.outLayout,
        includeNonExported: opts.includeNonExported ?? DEFAULT_BLOCKDOC_OPTIONS.includeNonExported,
    };
}
//# sourceMappingURL=options.js.map