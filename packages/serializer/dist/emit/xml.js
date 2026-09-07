export class XmlWriter {
    indent;
    parts = [];
    depth = 0;
    constructor(indent) {
        this.indent = indent;
    }
    line(raw = "") {
        if (this.indent === 0) {
            this.parts.push(raw);
            return;
        }
        const pad = " ".repeat(this.depth * this.indent);
        this.parts.push(pad + raw);
    }
    blank() {
        this.parts.push("");
    }
    pushDepth() {
        this.depth++;
    }
    popDepth() {
        this.depth--;
    }
    comments(trivia, trailing = false) {
        if (!trivia) {
            return;
        }
        const list = trailing ? trivia.trailingComments : trivia.leadingComments;
        if (!list?.length) {
            return;
        }
        for (const body of list) {
            this.line(`<!--${body}-->`);
        }
        if (trailing && list.length > 0) {
            this.blank();
        }
    }
    toString() {
        return this.parts.join("\n");
    }
}
/**
 * XML 1.0 Char minus U+FFFD. FFFD is a legal XML Char, but @xmldom/xmldom
 * reports it as "Unicode replacement character detected" → BML_MALFORMED_XML.
 */
function sanitizeXmlText(value) {
    let out = "";
    for (const ch of value) {
        const cp = ch.codePointAt(0);
        if (isSafeXmlChar(cp)) {
            out += ch;
            continue;
        }
        out +=
            cp <= 0xffff
                ? `\\u${cp.toString(16).toUpperCase().padStart(4, "0")}`
                : `\\u{${cp.toString(16).toUpperCase()}}`;
    }
    return out;
}
function isSafeXmlChar(cp) {
    if (cp === 0xfffd) {
        return false;
    }
    return (cp === 0x9 ||
        cp === 0xa ||
        cp === 0xd ||
        (cp >= 0x20 && cp <= 0xd7ff) ||
        (cp >= 0xe000 && cp <= 0xfffc) ||
        (cp >= 0x10000 && cp <= 0x10ffff));
}
export function escapeAttr(value) {
    return sanitizeXmlText(value)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;");
}
export function escapeText(value) {
    return sanitizeXmlText(value).replace(/&/g, "&amp;").replace(/</g, "&lt;");
}
export function needsCData(text) {
    return /[<&]/.test(text);
}
export function emitCharacterData(writer, text, form) {
    const safe = sanitizeXmlText(text);
    const lines = safe.split("\n");
    if (form === "cdata") {
        if (lines.length <= 1) {
            writer.line(`<![CDATA[${safe}]]>`);
            return;
        }
        writer.line("<![CDATA[");
        for (const line of lines) {
            writer.line(line);
        }
        writer.line("]]>");
        return;
    }
    for (const line of lines) {
        writer.line(escapeText(line));
    }
}
export function formatBoolean(value) {
    return value ? "true" : "false";
}
/** Inverse of ParseMemberValue unescape — emit string literals so `${` is not a hole. */
function escapeInterpolationDelimiters(raw) {
    let out = "";
    let i = 0;
    while (i < raw.length) {
        if (raw[i] === "\\") {
            let n = 0;
            while (i + n < raw.length && raw[i + n] === "\\") {
                n++;
            }
            if (raw[i + n] === "$" && raw[i + n + 1] === "{") {
                out += "\\".repeat(2 * n + 1);
                out += "${";
                i += n + 2;
                continue;
            }
            out += raw.slice(i, i + n);
            i += n;
            continue;
        }
        if (raw[i] === "$" && raw[i + 1] === "{") {
            out += "\\${";
            i += 2;
            continue;
        }
        out += raw[i];
        i++;
    }
    return out;
}
export function formatMemberValue(value) {
    if (typeof value === "boolean") {
        return formatBoolean(value);
    }
    if (typeof value === "string") {
        return escapeAttr(escapeInterpolationDelimiters(value));
    }
    if (typeof value === "number") {
        return String(value);
    }
    if (Array.isArray(value) || (typeof value === "object" && value !== null)) {
        return escapeAttr(JSON.stringify(value).replace(/"([^"]+)":/g, "$1:"));
    }
    return escapeAttr(String(value));
}
export { escapeInterpolationDelimiters };
//# sourceMappingURL=xml.js.map