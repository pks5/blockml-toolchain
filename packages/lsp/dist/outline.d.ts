import { type LspRange } from "./positions.js";
export declare const SymbolKind: {
    readonly Class: 5;
    readonly Method: 6;
    readonly Property: 7;
    readonly Field: 8;
};
export type SymbolKind = (typeof SymbolKind)[keyof typeof SymbolKind];
export interface OutlineSymbol {
    name: string;
    detail?: string;
    kind: SymbolKind;
    range: LspRange;
    selectionRange: LspRange;
    children?: OutlineSymbol[];
}
export declare function documentSymbols(text: string, filePath: string): OutlineSymbol[] | null;
//# sourceMappingURL=outline.d.ts.map