/**
 * Position-based highlight roles, aligned with
 * org.blockml.bml.vscode.theme.FrameworkRoles.
 *
 * Same tag local name (e.g. abstract, documentation, composition) colors
 * differently by XML nesting relative to the nearest <block>, not by keyword
 * lists alone. Lexical types cover comments, strings, and punctuation so
 * highlighting survives when the TextMate grammar loses its rule stack.
 */
export declare const SEMANTIC_TOKEN_TYPES: readonly ["root", "blockDeclaration", "blockFacet", "blockContainer", "memberContainer", "memberName", "memberField", "memberFacet", "memberSubContainer", "domainType", "compositionInstance", "tag", "attribute", "stringDouble", "stringSingle", "blockComment", "interpolation", "embed", "tagPunctuation", "commentPunctuation", "attributeSeparator"];
export type SemanticTokenType = (typeof SEMANTIC_TOKEN_TYPES)[number];
export declare const SEMANTIC_TOKEN_SCOPES: Record<SemanticTokenType, string>;
export declare const SEMANTIC_TOKEN_LEGEND: {
    tokenTypes: ("root" | "blockDeclaration" | "blockFacet" | "blockContainer" | "memberContainer" | "memberName" | "memberField" | "memberFacet" | "memberSubContainer" | "domainType" | "compositionInstance" | "tag" | "attribute" | "stringDouble" | "stringSingle" | "blockComment" | "interpolation" | "embed" | "tagPunctuation" | "commentPunctuation" | "attributeSeparator")[];
    tokenModifiers: string[];
};
export interface HighlightSpan {
    type: SemanticTokenType;
    startOffset: number;
    endOffset: number;
}
export interface SemanticTokensResult {
    data: number[];
}
export declare function semanticHighlightSpans(text: string): HighlightSpan[];
export declare function semanticTokensFor(text: string): SemanticTokensResult;
//# sourceMappingURL=semantic-tokens.d.ts.map