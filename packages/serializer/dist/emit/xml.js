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
export function escapeAttr(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;");
}
export function escapeText(value) {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}
export function needsCData(text) {
    return /[<&]/.test(text);
}
export function emitCharacterData(writer, text, form) {
    const lines = text.split("\n");
    if (form === "cdata") {
        if (lines.length <= 1) {
            writer.line(`<![CDATA[${text}]]>`);
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