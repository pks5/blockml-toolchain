import type { SourceLocation } from "@blockml/bom";
export declare class MappingError extends Error {
    readonly code: string;
    readonly source: SourceLocation;
    constructor(code: string, message: string, source: SourceLocation);
}
export interface AttrHint {
    name: string;
    value: string;
}
declare function withElementLocation<T>(file: string, source: string, element: {
    nodeName: string;
    lineNumber?: number;
    columnNumber?: number;
}, fn: () => T, attr?: AttrHint): T;
export { withElementLocation };
//# sourceMappingURL=mapping-error.d.ts.map