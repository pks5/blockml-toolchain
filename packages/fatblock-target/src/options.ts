export interface FatBlockOptions {
  /** Corpus pool root — required for v1 collection */
  srcDir?: string;
  /** Project root for resolving srcDir paths */
  rootDir?: string;
  /** Optional FQN filters: exact FQN or glob (e.g. com.foo.*) */
  include?: string[];
  /** v1: only error supported */
  embeddedBlocksStrategy?: "error";
}

export const DEFAULT_FATBLOCK_OPTIONS: Required<
  Pick<FatBlockOptions, "embeddedBlocksStrategy">
> = {
  embeddedBlocksStrategy: "error",
};

export function resolveFatBlockOptions(
  targetOptions?: unknown,
): Required<Pick<FatBlockOptions, "embeddedBlocksStrategy">> & FatBlockOptions {
  const opts = (targetOptions ?? {}) as FatBlockOptions;
  return {
    embeddedBlocksStrategy:
      opts.embeddedBlocksStrategy ?? DEFAULT_FATBLOCK_OPTIONS.embeddedBlocksStrategy,
    ...(opts.srcDir !== undefined ? { srcDir: opts.srcDir } : {}),
    ...(opts.rootDir !== undefined ? { rootDir: opts.rootDir } : {}),
    ...(opts.include !== undefined ? { include: opts.include } : {}),
  };
}
