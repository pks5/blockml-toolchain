export type TransformFailureKind = "resolve" | "execution" | "busy";
export declare class TransformError extends Error {
    readonly kind: TransformFailureKind;
    constructor(kind: TransformFailureKind, message: string);
    get exitCode(): number;
}
//# sourceMappingURL=errors.d.ts.map