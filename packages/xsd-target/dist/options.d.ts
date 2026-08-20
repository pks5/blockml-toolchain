export interface XsdOptions {
    /** when false, only Library.blocks exports inform extra particles; unused for V1 emit */
    includeNonExported?: boolean;
}
export declare const DEFAULT_XSD_OPTIONS: Required<XsdOptions>;
export declare function resolveXsdOptions(targetOptions?: unknown): Required<XsdOptions>;
//# sourceMappingURL=options.d.ts.map