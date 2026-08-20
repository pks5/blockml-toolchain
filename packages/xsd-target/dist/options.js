export const DEFAULT_XSD_OPTIONS = {
    includeNonExported: true,
    emitDomainSchemas: true,
};
export function resolveXsdOptions(targetOptions) {
    const opts = (targetOptions ?? {});
    return {
        includeNonExported: opts.includeNonExported ?? DEFAULT_XSD_OPTIONS.includeNonExported,
        emitDomainSchemas: opts.emitDomainSchemas ?? DEFAULT_XSD_OPTIONS.emitDomainSchemas,
    };
}
//# sourceMappingURL=options.js.map