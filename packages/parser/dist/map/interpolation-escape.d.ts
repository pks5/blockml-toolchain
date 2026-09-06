/**
 * JS-template-like `${` escaping: an opener is escaped when an odd number of
 * backslashes immediately precedes `$`. `\${` → literal `${`; `\\${` → `\` + hole.
 */
declare function containsUnescapedInterpolation(raw: string): boolean;
/** Turn authored `\${` escapes into literal `${` in a value with no holes. */
declare function unescapeInterpolationDelimiters(raw: string): string;
/** Inverse of unescapeInterpolationDelimiters — emit literals so parse sees no holes. */
declare function escapeInterpolationDelimiters(raw: string): string;
export { containsUnescapedInterpolation, escapeInterpolationDelimiters, unescapeInterpolationDelimiters, };
//# sourceMappingURL=interpolation-escape.d.ts.map