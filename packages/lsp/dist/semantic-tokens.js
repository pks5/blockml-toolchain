import { isDocumentRootLocalName } from "@blockml/parser";
import { offsetToPosition, xmlLocalName } from "./xml-token.js";
/**
 * Position-based highlight roles, aligned with
 * org.blockml.bml.vscode.theme.FrameworkRoles.
 *
 * Same tag local name (e.g. abstract, documentation, composition) colors
 * differently by XML nesting relative to the nearest document root or nested
 * <block>, not by keyword lists alone. Lexical types cover comments, strings,
 * and punctuation so highlighting survives when the TextMate grammar loses
 * its rule stack.
 */
function isBlockWrapper(local, ancestors) {
    if (local === "block") {
        return true;
    }
    if (!isDocumentRootLocalName(local)) {
        return false;
    }
    if (ancestors.length === 0) {
        return true;
    }
    const parent = ancestors[ancestors.length - 1];
    return parent === "subBlocks" || parent === "embeddedBlocks";
}
export const SEMANTIC_TOKEN_TYPES = [
    "root",
    "blockDeclaration",
    "blockFacet",
    "blockContainer",
    "memberContainer",
    "memberName",
    "memberField",
    "memberFacet",
    "memberSubContainer",
    "domainType",
    "compositionInstance",
    "tag",
    "attribute",
    "stringDouble",
    "stringSingle",
    "blockComment",
    "interpolation",
    "embed",
    "tagPunctuation",
    "commentPunctuation",
    "attributeSeparator",
];
export const SEMANTIC_TOKEN_SCOPES = {
    root: "entity.name.type.framework.root.bml",
    blockDeclaration: "keyword.other.block-declaration.bml",
    blockFacet: "support.type.block-facet.bml",
    blockContainer: "keyword.other.block-container.bml",
    memberContainer: "keyword.other.member-container.bml",
    memberName: "entity.name.member.bml",
    memberField: "keyword.other.member-field.bml",
    memberFacet: "support.type.member-facet.bml",
    memberSubContainer: "keyword.other.member-subcontainer.bml",
    domainType: "entity.name.type.bml",
    compositionInstance: "entity.name.type.instance.bml",
    tag: "entity.name.tag.bml",
    attribute: "entity.other.attribute-name.bml",
    stringDouble: "string.quoted.double.bml",
    stringSingle: "string.quoted.single.bml",
    blockComment: "comment.block.bml",
    interpolation: "keyword.other.interpolation.bml",
    embed: "keyword.control.embed.bml",
    tagPunctuation: "punctuation.definition.tag.bml",
    commentPunctuation: "punctuation.definition.comment.bml",
    attributeSeparator: "punctuation.separator.key-value.bml",
};
export const SEMANTIC_TOKEN_MODIFIERS = ["unnecessary"];
export const SEMANTIC_TOKEN_LEGEND = {
    tokenTypes: [...SEMANTIC_TOKEN_TYPES],
    tokenModifiers: [...SEMANTIC_TOKEN_MODIFIERS],
};
const UNNECESSARY_BIT = 1 << SEMANTIC_TOKEN_MODIFIERS.indexOf("unnecessary");
const BLOCK_DECLARATION = new Set([
    "name",
    "type",
    "baseType",
    "is",
    "isnot",
    "isNot",
    "version",
    "abstract",
    "final",
    "definition",
    "language",
]);
const BLOCK_FACET = new Set([
    "documentation",
    "summary",
    "status",
    "since",
    "changelog",
    "examples",
    "relation",
    "see",
    "bml:xml",
    "bml:container",
    "implementation",
]);
const BLOCK_CONTAINER = new Set([
    "contracts",
    "subBlocks",
    "embeddedBlocks",
    "composition",
    "genericTypes",
    "groups",
    "aliases",
    "keywords",
    "references",
]);
const MEMBER_CONTAINER = new Set([
    "properties",
    "aggregations",
    "associations",
    "capabilities",
    "constraints",
]);
const MEMBER_FIELD = new Set([
    "type",
    "abstract",
    "final",
    "override",
    "readOnly",
    "visibility",
    "default",
]);
const MEMBER_FACET = new Set([
    "value",
    "documentation",
    "summary",
    "implementation",
    "inputType",
    "outputType",
    "status",
    "since",
    "changelog",
    "examples",
    "relation",
    "see",
    "bml:xml",
    "bml:container",
]);
const MEMBER_SUBCONTAINER = new Set([
    "suggestions",
    "composition",
    "constraints",
    "groups",
    "implementation",
]);
const TOKEN_TYPE_INDEX = Object.fromEntries(SEMANTIC_TOKEN_TYPES.map((type, index) => [type, index]));
/** Type-or-name local: visibility underscores + PascalCase, matching IsDocumentRootLocalName. */
function isTypeOrNameLocal(local) {
    return local !== "block" && isDocumentRootLocalName(local);
}
function isNameStart(ch) {
    return ch !== undefined && /[A-Za-z_]/.test(ch);
}
function isNameChar(ch) {
    return ch !== undefined && /[A-Za-z0-9_.:-]/.test(ch);
}
function skipWs(text, i) {
    while (i < text.length && /[ \t\n\r]/.test(text[i])) {
        i++;
    }
    return i;
}
function readName(text, i) {
    if (!isNameStart(text[i])) {
        return undefined;
    }
    const start = i;
    i++;
    while (isNameChar(text[i])) {
        i++;
    }
    return { name: text.slice(start, i), start, end: i };
}
function namePrefix(name) {
    const idx = name.indexOf(":");
    return idx > 0 ? name.slice(0, idx) : undefined;
}
function xmlnsDeclaredPrefix(attrName) {
    return attrName.startsWith("xmlns:") ? attrName.slice("xmlns:".length) : undefined;
}
function addQNamePrefixes(chunk, used) {
    const re = /[A-Za-z_][\w.-]*:[A-Za-z_]/g;
    let match;
    while ((match = re.exec(chunk))) {
        const prefix = match[0].slice(0, match[0].lastIndexOf(":"));
        if (prefix !== "xmlns") {
            used.add(prefix);
        }
    }
}
/** Root xmlns:<prefix> bindings whose prefix is never used as a QName in this document. */
export function unusedRootNamespacePrefixes(text) {
    const declared = new Set();
    const used = new Set();
    let i = 0;
    let seenRoot = false;
    while (i < text.length) {
        if (text.startsWith("<!--", i)) {
            const close = text.indexOf("-->", i + 4);
            i = close === -1 ? text.length : close + 3;
            continue;
        }
        if (text.startsWith("<![CDATA[", i)) {
            const start = i + 9;
            const end = text.indexOf("]]>", start);
            const close = end === -1 ? text.length : end;
            addQNamePrefixes(text.slice(start, close), used);
            i = end === -1 ? text.length : end + 3;
            continue;
        }
        if (text.startsWith("<?", i)) {
            const end = text.indexOf("?>", i + 2);
            i = end === -1 ? text.length : end + 2;
            continue;
        }
        if (text.startsWith("<!", i)) {
            const end = text.indexOf(">", i + 2);
            i = end === -1 ? text.length : end + 1;
            continue;
        }
        if (text.startsWith("<$", i)) {
            const end = text.indexOf("$>", i + 2);
            i = end === -1 ? text.length : end + 2;
            continue;
        }
        if (text[i] === "<") {
            const isClose = text.startsWith("</", i);
            const name = readName(text, i + (isClose ? 2 : 1));
            if (!name) {
                i++;
                continue;
            }
            const prefix = namePrefix(name.name);
            if (prefix) {
                used.add(prefix);
            }
            const onRoot = !seenRoot && !isClose;
            if (onRoot) {
                seenRoot = true;
            }
            let j = skipWs(text, name.end);
            while (j < text.length) {
                if (text.startsWith("/>", j)) {
                    j += 2;
                    break;
                }
                if (text[j] === ">") {
                    j++;
                    break;
                }
                const attr = readName(text, j);
                if (!attr) {
                    j++;
                    continue;
                }
                const declaredPrefix = xmlnsDeclaredPrefix(attr.name);
                if (onRoot && declaredPrefix !== undefined) {
                    declared.add(declaredPrefix);
                }
                else {
                    const attrPrefix = namePrefix(attr.name);
                    if (attrPrefix && attrPrefix !== "xmlns") {
                        used.add(attrPrefix);
                    }
                }
                j = skipWs(text, attr.end);
                if (text[j] === "=") {
                    j = skipWs(text, j + 1);
                    const quote = text[j];
                    if (quote === '"' || quote === "'") {
                        const valueStart = j + 1;
                        const valueEnd = text.indexOf(quote, valueStart);
                        const close = valueEnd === -1 ? text.length : valueEnd;
                        if (declaredPrefix === undefined) {
                            addQNamePrefixes(text.slice(valueStart, close), used);
                        }
                        j = valueEnd === -1 ? text.length : valueEnd + 1;
                    }
                }
                j = skipWs(text, j);
            }
            i = j;
            continue;
        }
        const nextTag = text.indexOf("<", i);
        const end = nextTag === -1 ? text.length : nextTag;
        addQNamePrefixes(text.slice(i, end), used);
        if (nextTag === -1) {
            break;
        }
        i = nextTag;
    }
    const unused = new Set();
    for (const prefix of declared) {
        if (!used.has(prefix)) {
            unused.add(prefix);
        }
    }
    return unused;
}
function matchesTag(tokenText, local, tags) {
    if (tags.has(tokenText) || tags.has(local)) {
        return true;
    }
    if (local === "xml" && tags.has("bml:xml")) {
        return true;
    }
    if (local === "container" && tags.has("bml:container")) {
        return true;
    }
    return false;
}
function bodyOf(parentAncestors) {
    let body = "blockBody";
    let seenBlock = false;
    const walked = [];
    for (const raw of parentAncestors) {
        const name = xmlLocalName(raw);
        if (isBlockWrapper(name, walked)) {
            seenBlock = true;
            body = "blockBody";
            walked.push(name);
            continue;
        }
        walked.push(name);
        if (!seenBlock) {
            continue;
        }
        switch (body) {
            case "blockBody":
                if (MEMBER_CONTAINER.has(name)) {
                    body = "memberContainerBody";
                }
                else if (BLOCK_CONTAINER.has(name)) {
                    body = "blockBody";
                }
                else if (BLOCK_DECLARATION.has(name) || matchesTag(raw, name, BLOCK_FACET)) {
                    body = "declarationBody";
                }
                else {
                    body = "memberBody";
                }
                break;
            case "memberContainerBody":
                body = "memberBody";
                break;
            case "memberBody":
                if (MEMBER_FIELD.has(name) || matchesTag(raw, name, MEMBER_FACET)) {
                    body = "declarationBody";
                }
                else if (MEMBER_SUBCONTAINER.has(name)) {
                    body = "memberSubContainerBody";
                }
                break;
            case "memberSubContainerBody":
                if (isTypeOrNameLocal(name)) {
                    body = "memberBody";
                }
                else if (MEMBER_FIELD.has(name) || matchesTag(raw, name, MEMBER_FACET)) {
                    body = "declarationBody";
                }
                else if (MEMBER_SUBCONTAINER.has(name)) {
                    body = "memberSubContainerBody";
                }
                else {
                    body = "memberBody";
                }
                break;
            case "declarationBody":
                body = "memberBody";
                break;
        }
    }
    return body;
}
function classifyElement(tokenText, local, body, ancestors) {
    if (isBlockWrapper(local, ancestors)) {
        return "root";
    }
    switch (body) {
        case "blockBody":
            if (matchesTag(tokenText, local, BLOCK_DECLARATION)) {
                return "blockDeclaration";
            }
            if (matchesTag(tokenText, local, BLOCK_FACET)) {
                return "blockFacet";
            }
            if (matchesTag(tokenText, local, BLOCK_CONTAINER)) {
                return "blockContainer";
            }
            if (matchesTag(tokenText, local, MEMBER_CONTAINER)) {
                return "memberContainer";
            }
            if (isTypeOrNameLocal(local)) {
                return "domainType";
            }
            return "memberName";
        case "memberContainerBody":
            return "memberName";
        case "memberBody":
            if (matchesTag(tokenText, local, MEMBER_FIELD)) {
                return "memberField";
            }
            if (matchesTag(tokenText, local, MEMBER_FACET)) {
                return "memberFacet";
            }
            if (matchesTag(tokenText, local, MEMBER_SUBCONTAINER)) {
                return "memberSubContainer";
            }
            if (isTypeOrNameLocal(local)) {
                return "domainType";
            }
            return "tag";
        case "memberSubContainerBody":
            if (matchesTag(tokenText, local, MEMBER_FIELD)) {
                return "memberField";
            }
            if (matchesTag(tokenText, local, MEMBER_FACET)) {
                return "memberFacet";
            }
            if (matchesTag(tokenText, local, MEMBER_SUBCONTAINER)) {
                return "memberSubContainer";
            }
            if (isTypeOrNameLocal(local)) {
                return "compositionInstance";
            }
            return "tag";
        case "declarationBody":
            if (isTypeOrNameLocal(local)) {
                return "domainType";
            }
            return "tag";
    }
}
function pushSpan(spans, type, start, end, unnecessary = false) {
    if (end > start) {
        spans.push({ type, startOffset: start, endOffset: end, ...(unnecessary ? { unnecessary: true } : {}) });
    }
}
function findSpecial(text, from, until) {
    const interp = text.indexOf("${", from);
    const embed = text.indexOf("<$", from);
    const interpOk = interp !== -1 && interp < until;
    const embedOk = embed !== -1 && embed < until;
    if (!interpOk && !embedOk) {
        return null;
    }
    if (interpOk && (!embedOk || interp < embed)) {
        const close = text.indexOf("}", interp + 2);
        const end = close === -1 || close >= until ? until : close + 1;
        return { start: interp, end, type: "interpolation" };
    }
    const close = text.indexOf("$>", embed + 2);
    const end = close === -1 || close >= until ? until : close + 2;
    return { start: embed, end, type: "embed" };
}
function emitQuoted(spans, text, valueStart, valueEnd, stringType, unnecessary = false) {
    let pos = valueStart;
    while (pos < valueEnd) {
        const special = findSpecial(text, pos, valueEnd);
        if (!special) {
            pushSpan(spans, stringType, pos, valueEnd, unnecessary);
            return;
        }
        pushSpan(spans, stringType, pos, special.start, unnecessary);
        pushSpan(spans, special.type, special.start, special.end, unnecessary);
        pos = special.end;
    }
}
function emitTextSpecials(spans, text, start, end) {
    let pos = start;
    while (pos < end) {
        const special = findSpecial(text, pos, end);
        if (!special) {
            return;
        }
        pushSpan(spans, special.type, special.start, special.end);
        pos = special.end;
    }
}
export function semanticHighlightSpans(text) {
    const spans = [];
    const stack = [];
    const unusedPrefixes = unusedRootNamespacePrefixes(text);
    let i = 0;
    while (i < text.length) {
        if (text.startsWith("<!--", i)) {
            const close = text.indexOf("-->", i + 4);
            const bodyEnd = close === -1 ? text.length : close;
            pushSpan(spans, "commentPunctuation", i, i + 4);
            pushSpan(spans, "blockComment", i + 4, bodyEnd);
            if (close !== -1) {
                pushSpan(spans, "commentPunctuation", close, close + 3);
                i = close + 3;
            }
            else {
                i = text.length;
            }
            continue;
        }
        if (text.startsWith("<![CDATA[", i)) {
            const start = i + 9;
            const end = text.indexOf("]]>", start);
            const close = end === -1 ? text.length : end;
            emitTextSpecials(spans, text, start, close);
            i = end === -1 ? text.length : end + 3;
            continue;
        }
        if (text.startsWith("<?", i)) {
            const end = text.indexOf("?>", i + 2);
            i = end === -1 ? text.length : end + 2;
            continue;
        }
        if (text.startsWith("<!", i)) {
            const end = text.indexOf(">", i + 2);
            i = end === -1 ? text.length : end + 1;
            continue;
        }
        if (text.startsWith("<$", i)) {
            const end = text.indexOf("$>", i + 2);
            const close = end === -1 ? text.length : end + 2;
            pushSpan(spans, "embed", i, close);
            i = close;
            continue;
        }
        if (text.startsWith("</", i)) {
            const name = readName(text, i + 2);
            if (!name) {
                i++;
                continue;
            }
            const local = xmlLocalName(name.name);
            const ancestors = stack.length > 0 ? stack : [local];
            const parents = ancestors.slice(0, -1);
            const body = bodyOf(parents);
            pushSpan(spans, "tagPunctuation", i, i + 2);
            pushSpan(spans, classifyElement(name.name, local, body, parents), name.start, name.end);
            if (stack.length > 0) {
                stack.pop();
            }
            const gt = text.indexOf(">", name.end);
            if (gt === -1) {
                i = text.length;
            }
            else {
                pushSpan(spans, "tagPunctuation", gt, gt + 1);
                i = gt + 1;
            }
            continue;
        }
        if (text[i] === "<") {
            const name = readName(text, i + 1);
            if (!name) {
                i++;
                continue;
            }
            const local = xmlLocalName(name.name);
            stack.push(local);
            const parents = stack.slice(0, -1);
            const body = bodyOf(parents);
            pushSpan(spans, "tagPunctuation", i, i + 1);
            pushSpan(spans, classifyElement(name.name, local, body, parents), name.start, name.end);
            let j = skipWs(text, name.end);
            let selfClosing = false;
            while (j < text.length) {
                if (text.startsWith("/>", j)) {
                    selfClosing = true;
                    pushSpan(spans, "tagPunctuation", j, j + 2);
                    j += 2;
                    break;
                }
                if (text[j] === ">") {
                    pushSpan(spans, "tagPunctuation", j, j + 1);
                    j++;
                    break;
                }
                const attr = readName(text, j);
                if (!attr) {
                    j++;
                    continue;
                }
                const declaredPrefix = xmlnsDeclaredPrefix(attr.name);
                const unusedNs = stack.length === 1 &&
                    declaredPrefix !== undefined &&
                    unusedPrefixes.has(declaredPrefix);
                pushSpan(spans, "attribute", attr.start, attr.end, unusedNs);
                j = skipWs(text, attr.end);
                if (text[j] === "=") {
                    pushSpan(spans, "attributeSeparator", j, j + 1, unusedNs);
                    j = skipWs(text, j + 1);
                    const quote = text[j];
                    if (quote === '"' || quote === "'") {
                        const valueStart = j + 1;
                        const valueEnd = text.indexOf(quote, valueStart);
                        const close = valueEnd === -1 ? text.length : valueEnd;
                        const stringType = quote === '"' ? "stringDouble" : "stringSingle";
                        pushSpan(spans, stringType, j, j + 1, unusedNs);
                        emitQuoted(spans, text, valueStart, close, stringType, unusedNs);
                        if (valueEnd !== -1) {
                            pushSpan(spans, stringType, valueEnd, valueEnd + 1, unusedNs);
                            j = valueEnd + 1;
                        }
                        else {
                            j = text.length;
                        }
                    }
                }
                j = skipWs(text, j);
            }
            if (selfClosing && stack.length > 0) {
                stack.pop();
            }
            i = j;
            continue;
        }
        const nextTag = text.indexOf("<", i);
        const dollar = text.indexOf("${", i);
        let end = text.length;
        if (nextTag !== -1) {
            end = nextTag;
        }
        if (dollar !== -1 && dollar < end) {
            emitTextSpecials(spans, text, i, end);
            i = end;
            continue;
        }
        if (nextTag === -1) {
            emitTextSpecials(spans, text, i, text.length);
            break;
        }
        emitTextSpecials(spans, text, i, nextTag);
        i = nextTag;
    }
    return spans;
}
export function semanticTokensFor(text) {
    const spans = semanticHighlightSpans(text);
    const pieces = [];
    for (const span of spans) {
        const typeIndex = TOKEN_TYPE_INDEX[span.type];
        const modifiers = span.unnecessary ? UNNECESSARY_BIT : 0;
        let offset = span.startOffset;
        while (offset < span.endOffset) {
            const pos = offsetToPosition(text, offset);
            const nl = text.indexOf("\n", offset);
            const lineEnd = nl === -1 || nl > span.endOffset ? span.endOffset : nl;
            const length = lineEnd - offset;
            if (length > 0) {
                pieces.push({
                    line: pos.line,
                    character: pos.character,
                    length,
                    type: typeIndex,
                    modifiers,
                });
            }
            if (nl === -1 || nl >= span.endOffset) {
                break;
            }
            offset = nl + 1;
        }
    }
    pieces.sort((a, b) => a.line - b.line || a.character - b.character);
    const data = [];
    let prevLine = 0;
    let prevChar = 0;
    for (const piece of pieces) {
        const deltaLine = piece.line - prevLine;
        const deltaStart = deltaLine === 0 ? piece.character - prevChar : piece.character;
        data.push(deltaLine, deltaStart, piece.length, piece.type, piece.modifiers);
        prevLine = piece.line;
        prevChar = piece.character;
    }
    return { data };
}
//# sourceMappingURL=semantic-tokens.js.map