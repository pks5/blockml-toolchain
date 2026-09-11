export declare const SEMANTIC_TOKEN_TYPES: readonly ["root", "blockDeclaration", "blockFacet", "blockContainer", "memberContainer", "memberName", "memberField", "memberFacet", "memberSubContainer", "domainType", "compositionInstance", "tag", "attribute", "stringDouble", "stringSingle", "blockComment", "interpolation", "embed", "tagPunctuation", "commentPunctuation", "attributeSeparator"];
export type SemanticTokenType = (typeof SEMANTIC_TOKEN_TYPES)[number];
export declare const SEMANTIC_TOKEN_SCOPES: Record<SemanticTokenType, string>;
export declare const SEMANTIC_TOKEN_MODIFIERS: readonly ["unnecessary"];
export type SemanticTokenModifier = (typeof SEMANTIC_TOKEN_MODIFIERS)[number];
export declare const SEMANTIC_TOKEN_LEGEND: {
    tokenTypes: ("root" | "blockDeclaration" | "blockFacet" | "blockContainer" | "memberContainer" | "memberName" | "memberField" | "memberFacet" | "memberSubContainer" | "domainType" | "compositionInstance" | "tag" | "attribute" | "stringDouble" | "stringSingle" | "blockComment" | "interpolation" | "embed" | "tagPunctuation" | "commentPunctuation" | "attributeSeparator")[];
    tokenModifiers: "unnecessary"[];
};
export interface HighlightSpan {
    type: SemanticTokenType;
    startOffset: number;
    endOffset: number;
    /** Unused root xmlns:<prefix> declaration (standard LSP unnecessary). */
    unnecessary?: boolean;
}
export interface SemanticTokensResult {
    data: number[];
}
/** Root xmlns:<prefix> bindings whose prefix is never used as a QName in this document. */
export declare function unusedRootNamespacePrefixes(text: string): Set<string>;
export declare function semanticHighlightSpans(text: string): HighlightSpan[];
export declare function semanticTokensFor(text: string): SemanticTokensResult;
//# sourceMappingURL=semantic-tokens.d.ts.map