export const DEFAULT_XSD_OPTIONS = {
    includeNonExported: true,
};
export function resolveXsdOptions(targetOptions) {
    const opts = (targetOptions ?? {});
    return {
        includeNonExported: opts.includeNonExported ?? DEFAULT_XSD_OPTIONS.includeNonExported,
    };
}
//# sourceMappingURL=options.js.map