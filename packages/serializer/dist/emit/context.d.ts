export interface EmitContext {
    bindings: Record<string, string>;
    useQName: boolean;
    indent: number;
}
export declare function createEmitContext(bindings: Record<string, string>, indent: number): EmitContext;
//# sourceMappingURL=context.d.ts.map