/**
 * JS-template-like `${` escaping: an opener is escaped when an odd number of
 * backslashes immediately precedes `$`. `\${` → literal `${`; `\\${` → `\` + hole.
 */
function countBackslashes(raw, start) {
    let n = 0;
    while (start + n < raw.length && raw[start + n] === "\\") {
        n++;
    }
    return n;
}
function isDollarBrace(raw, index) {
    return raw[index] === "$" && raw[index + 1] === "{";
}
function containsUnescapedInterpolation(raw) {
    let i = 0;
    while (i < raw.length) {
        if (raw[i] === "\\") {
            const n = countBackslashes(raw, i);
            if (isDollarBrace(raw, i + n)) {
                if (n % 2 === 0) {
                    return true;
                }
                i += n + 2;
                continue;
            }
            i += n;
            continue;
        }
        if (isDollarBrace(raw, i)) {
            return true;
        }
        i++;
    }
    return false;
}
/** Turn authored `\${` escapes into literal `${` in a value with no holes. */
function unescapeInterpolationDelimiters(raw) {
    let out = "";
    let i = 0;
    while (i < raw.length) {
        if (raw[i] === "\\") {
            const n = countBackslashes(raw, i);
            if (isDollarBrace(raw, i + n)) {
                out += "\\".repeat(Math.floor(n / 2));
                out += "${";
                i += n + 2;
                continue;
            }
            out += raw.slice(i, i + n);
            i += n;
            continue;
        }
        out += raw[i];
        i++;
    }
    return out;
}
/** Inverse of unescapeInterpolationDelimiters — emit literals so parse sees no holes. */
function escapeInterpolationDelimiters(raw) {
    let out = "";
    let i = 0;
    while (i < raw.length) {
        if (raw[i] === "\\") {
            const n = countBackslashes(raw, i);
            if (isDollarBrace(raw, i + n)) {
                out += "\\".repeat(2 * n + 1);
                out += "${";
                i += n + 2;
                continue;
            }
            out += raw.slice(i, i + n);
            i += n;
            continue;
        }
        if (isDollarBrace(raw, i)) {
            out += "\\${";
            i += 2;
            continue;
        }
        out += raw[i];
        i++;
    }
    return out;
}
export { containsUnescapedInterpolation, escapeInterpolationDelimiters, unescapeInterpolationDelimiters, };
//# sourceMappingURL=interpolation-escape.js.map