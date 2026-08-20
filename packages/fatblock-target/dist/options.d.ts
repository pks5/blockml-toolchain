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
export declare const DEFAULT_FATBLOCK_OPTIONS: Required<Pick<FatBlockOptions, "embeddedBlocksStrategy">>;
export declare function resolveFatBlockOptions(targetOptions?: unknown): Required<Pick<FatBlockOptions, "embeddedBlocksStrategy">> & FatBlockOptions;
//# sourceMappingURL=options.d.ts.map