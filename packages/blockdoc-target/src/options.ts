export interface BlockDocOptions {
  /** default: "merged" — one site for all libraries in scope */
  siteMode?: "merged" | "perLibrary";
  /** URL path layout under outDir — default: "fqn" */
  outLayout?: "fqn" | "package";
  /** when false, only Library.blocks exports; when true, all .bml under roots */
  includeNonExported?: boolean;
}

export const DEFAULT_BLOCKDOC_OPTIONS: Required<BlockDocOptions> = {
  siteMode: "merged",
  outLayout: "fqn",
  includeNonExported: true,
};

export function resolveBlockDocOptions(
  targetOptions?: unknown,
): Required<BlockDocOptions> {
  const opts = (targetOptions ?? {}) as BlockDocOptions;
  return {
    siteMode: opts.siteMode ?? DEFAULT_BLOCKDOC_OPTIONS.siteMode,
    outLayout: opts.outLayout ?? DEFAULT_BLOCKDOC_OPTIONS.outLayout,
    includeNonExported:
      opts.includeNonExported ?? DEFAULT_BLOCKDOC_OPTIONS.includeNonExported,
  };
}
