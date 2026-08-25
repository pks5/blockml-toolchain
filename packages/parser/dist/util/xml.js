export function isElement(node) {
    return node.nodeType === 1;
}
export function isComment(node) {
    return node.nodeType === 8;
}
export function isTextNode(node) {
    return node.nodeType === 3;
}
export function isCData(node) {
    return node.nodeType === 4;
}
export function elementChildren(element) {
    const out = [];
    for (let i = 0; i < element.childNodes.length; i++) {
        const child = element.childNodes.item(i);
        if (child && isElement(child)) {
            out.push(child);
        }
    }
    return out;
}
export function elementLocalName(element) {
    const name = element.nodeName;
    const idx = name.indexOf(":");
    return idx === -1 ? name : name.slice(idx + 1);
}
export function elementPrefix(element) {
    const name = element.nodeName;
    const idx = name.indexOf(":");
    return idx === -1 ? "" : name.slice(0, idx);
}
export function getAttribute(element, name) {
    const value = element.getAttribute(name);
    return value === null ? undefined : value;
}
export function getCharacterData(element) {
    let text = "";
    let form = "text";
    for (let i = 0; i < element.childNodes.length; i++) {
        const child = element.childNodes.item(i);
        if (isCData(child)) {
            text += child.data;
            form = "cdata";
        }
        else if (isTextNode(child)) {
            text += child.data;
        }
    }
    return { text: trimText(text), form };
}
export function collectLeadingComments(siblings, index) {
    const comments = [];
    for (let i = index - 1; i >= 0; i--) {
        const node = siblings[i];
        if (isComment(node)) {
            comments.unshift(node.data.trim());
            continue;
        }
        if (isTextNode(node) && node.data.trim() === "") {
            continue;
        }
        break;
    }
    return comments;
}
export function collectTrailingComments(siblings, index) {
    let i = index + 1;
    while (i < siblings.length) {
        const node = siblings[i];
        if (isTextNode(node) && node.data.trim() === "") {
            i++;
            continue;
        }
        if (isComment(node)) {
            // Comments before the next element sibling are leading for that element (B11) — not trailing here.
            let j = i;
            while (j < siblings.length && isComment(siblings[j])) {
                j++;
            }
            while (j < siblings.length) {
                const after = siblings[j];
                if (isTextNode(after) && after.data.trim() === "") {
                    j++;
                    continue;
                }
                break;
            }
            if (j < siblings.length && isElement(siblings[j])) {
                return [];
            }
            const comments = [];
            while (i < siblings.length && isComment(siblings[i])) {
                comments.push(siblings[i].data.trim());
                i++;
            }
            return comments;
        }
        break;
    }
    return [];
}
export function xmlTriviaFromElement(element) {
    const parent = element.parentNode;
    if (!parent) {
        return undefined;
    }
    const siblings = Array.from(parent.childNodes);
    let index = -1;
    for (let i = 0; i < siblings.length; i++) {
        if (siblings[i] === element) {
            index = i;
            break;
        }
    }
    if (index === -1) {
        return undefined;
    }
    const leadingComments = collectLeadingComments(siblings, index);
    const trailingComments = collectTrailingComments(siblings, index);
    const trivia = {};
    if (leadingComments.length > 0) {
        trivia.leadingComments = leadingComments;
    }
    if (trailingComments.length > 0) {
        trivia.trailingComments = trailingComments;
    }
    return Object.keys(trivia).length > 0 ? trivia : undefined;
}
/**
 * Strip the longest leading whitespace prefix shared by every non-empty line,
 * then trim the result. Pretty-printed XML indent is formatting (B13) and must
 * not be stored on character-data fields; relative extra indent is kept.
 */
export function trimText(value) {
    const lines = value.split(/\r\n|\n|\r/);
    const prefix = commonLeadingWhitespace(lines);
    const stripped = prefix.length === 0
        ? lines
        : lines.map((line) => line.startsWith(prefix) ? line.slice(prefix.length) : line.trim() === "" ? "" : line);
    return stripped.join("\n").trim();
}
function commonLeadingWhitespace(lines) {
    let prefix;
    for (const line of lines) {
        if (line.trim() === "") {
            continue;
        }
        const ws = /^[ \t]*/.exec(line)?.[0] ?? "";
        if (prefix === undefined) {
            prefix = ws;
            continue;
        }
        let i = 0;
        const limit = Math.min(prefix.length, ws.length);
        while (i < limit && prefix.charCodeAt(i) === ws.charCodeAt(i)) {
            i++;
        }
        prefix = prefix.slice(0, i);
        if (prefix.length === 0) {
            return "";
        }
    }
    return prefix ?? "";
}
//# sourceMappingURL=xml.js.map