export interface MapContext {
    filePath: string;
    source: string;
    bindings: Record<string, string>;
    subBlockIndex: Map<string, string>;
    parentBlockType?: string;
    isRoot: boolean;
    isEmbedded: boolean;
}
export declare function createMapContext(filePath: string, source: string, bindings: Record<string, string>, options?: {
    subBlockIndex?: Map<string, string>;
    parentBlockType?: string;
    isRoot?: boolean;
    isEmbedded?: boolean;
}): MapContext;
//# sourceMappingURL=context.d.ts.map