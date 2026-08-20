export const DEFAULT_FATBLOCK_OPTIONS = {
    embeddedBlocksStrategy: "error",
};
export function resolveFatBlockOptions(targetOptions) {
    const opts = (targetOptions ?? {});
    return {
        embeddedBlocksStrategy: opts.embeddedBlocksStrategy ?? DEFAULT_FATBLOCK_OPTIONS.embeddedBlocksStrategy,
        ...(opts.srcDir !== undefined ? { srcDir: opts.srcDir } : {}),
        ...(opts.rootDir !== undefined ? { rootDir: opts.rootDir } : {}),
        ...(opts.include !== undefined ? { include: opts.include } : {}),
    };
}
//# sourceMappingURL=options.js.map