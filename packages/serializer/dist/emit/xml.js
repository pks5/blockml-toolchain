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
    if (form === "cdata") {
        writer.line(`<![CDATA[${text}]]>`);
    }
    else {
        writer.line(escapeText(text));
    }
}
export function formatBoolean(value) {
    return value ? "true" : "false";
}
export function formatMemberValue(value) {
    if (typeof value === "boolean") {
        return formatBoolean(value);
    }
    if (typeof value === "string") {
        return escapeAttr(value);
    }
    if (typeof value === "number") {
        return String(value);
    }
    if (Array.isArray(value) || (typeof value === "object" && value !== null)) {
        return escapeAttr(JSON.stringify(value).replace(/"([^"]+)":/g, "$1:"));
    }
    return escapeAttr(String(value));
}
//# sourceMappingURL=xml.js.map