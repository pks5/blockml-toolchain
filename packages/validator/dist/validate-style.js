import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const MARKDOWN_MIN_LENGTH = 280;
const FALLBACK_RULES = [
    {
        name: "CDataWhenEscaping",
        code: "BML_STYLE_PREFER_CDATA",
        severity: "recommendation",
        message: "Use CDATA instead of XML entity escaping in documentation.",
        check: "PreferCDataWhenNeedsEscape",
    },
    {
        name: "MarkdownStructure",
        code: "BML_STYLE_PREFER_MARKDOWN",
        severity: "recommendation",
        message: "Structure long documentation with markdown (headings, lists, or paragraphs).",
        check: "PreferMarkdownStructure",
    },
    {
        name: "EmptyElementSelfClosing",
        code: "BML_STYLE_EMPTY_ELEMENT_SELF_CLOSE",
        severity: "warning",
        message: "Write empty elements as self-closing tags.",
        check: "PreferEmptyElementSelfClosing",
    },
    {
        name: "TypeAsTag",
        code: "BML_STYLE_LEGACY_BLOCK_WRAPPER",
        severity: "warning",
        message: "Prefer a type-or-name tag instead of the legacy block wrapper.",
        check: "PreferTypeAsTag",
    },
    {
        name: "OmitRedundantType",
        code: "BML_STYLE_REDUNDANT_TYPE",
        severity: "warning",
        message: "Omit child type when the element tag already supplies the type.",
        check: "PreferOmitRedundantType",
    },
    {
        name: "OmitSubBlockIdentity",
        code: "BML_STYLE_REDUNDANT_SUBBLOCK_IDENTITY",
        severity: "warning",
        message: "Omit child name and type on preferred-form Sub-Blocks; the tag is the name and the type is derived.",
        check: "PreferOmitSubBlockIdentity",
    },
];
function styleRuleDir() {
    const here = dirname(fileURLToPath(import.meta.url));
    return join(here, "..", "blocks/org/blockml/bml/compiler/validator/style/rule");
}
function propertyValue(source, name) {
    const re = new RegExp(`<${name}\\b[\\s\\S]*?<value>([\\s\\S]*?)</value>`);
    return source.match(re)?.[1]?.trim();
}
function checkTypeName(source) {
    return source.match(/<check>[\s\S]*?<(?:[\w]+:)?(\w+)\s*\/>/)?.[1];
}
let cachedRules;
function loadStyleCatalog() {
    if (cachedRules) {
        return cachedRules;
    }
    const dir = styleRuleDir();
    if (!existsSync(dir)) {
        cachedRules = FALLBACK_RULES;
        return cachedRules;
    }
    const rules = [];
    for (const entry of readdirSync(dir)) {
        if (!entry.endsWith(".bml")) {
            continue;
        }
        const text = readFileSync(join(dir, entry), "utf8");
        const name = text.match(/<name>([^<]+)<\/name>/)?.[1]?.trim();
        const code = propertyValue(text, "code");
        const severity = propertyValue(text, "severity");
        const message = propertyValue(text, "message");
        const check = checkTypeName(text);
        if (!name || !code || !severity || !message || !check) {
            continue;
        }
        rules.push({ name, code, severity, message, check });
    }
    cachedRules = rules.length > 0 ? rules : FALLBACK_RULES;
    return cachedRules;
}
function needsCData(text) {
    return /[<&]/.test(text);
}
function hasMarkdownStructure(text) {
    return (/\n\s*\n/.test(text) ||
        /^#{1,6} /m.test(text) ||
        /^(\s*[-*] |\s*\d+\. |\s*• )/m.test(text));
}
function loc(file, source) {
    return source ?? { file, line: 1, column: 1 };
}
function styleDiag(rule, file, source) {
    return {
        severity: rule.severity,
        code: rule.code,
        message: rule.message,
        source: loc(file, source),
    };
}
function walkBlocks(block, role, visit) {
    visit(block, role);
    for (const sub of block.subBlocks) {
        walkBlocks(sub, "subBlock", visit);
    }
    for (const emb of block.embeddedBlocks) {
        walkBlocks(emb, "embedded", visit);
    }
}
function collectReferences(block) {
    const refs = [...(block.references ?? [])];
    for (const member of block.members) {
        refs.push(...(member.references ?? []));
    }
    return refs;
}
function runPreferTypeAsTag(rule, block, _role, file, out) {
    if (block.wrapperForm === "block") {
        out.push(styleDiag(rule, file, block.source));
    }
}
function runPreferOmitRedundantType(rule, block, role, file, out) {
    if (block.wrapperForm === "type" && role !== "subBlock" && block.authoredTypeChild) {
        out.push(styleDiag(rule, file, block.typeSource ?? block.source));
    }
}
function runPreferOmitSubBlockIdentity(rule, block, role, file, out) {
    if (role === "subBlock" &&
        block.wrapperForm === "type" &&
        (block.authoredNameChild || block.authoredTypeChild)) {
        out.push(styleDiag(rule, file, block.source));
    }
}
function runPreferCData(rule, block, _role, file, out) {
    for (const prose of block.documentations ?? []) {
        if (needsCData(prose.text) && prose.authoredCharacterDataForm !== "cdata") {
            out.push(styleDiag(rule, file, prose.source));
        }
    }
}
function runPreferMarkdown(rule, block, _role, file, out) {
    for (const prose of block.documentations ?? []) {
        if (prose.text.length > MARKDOWN_MIN_LENGTH && !hasMarkdownStructure(prose.text)) {
            out.push(styleDiag(rule, file, prose.source));
        }
    }
}
function runPreferSelfClosing(rule, block, _role, file, out) {
    for (const ref of collectReferences(block)) {
        if (ref.context.trim() === "" && ref.authoredEmptyElementForm === "paired") {
            out.push(styleDiag(rule, file, ref.source));
        }
    }
}
const INTERPRETERS = {
    PreferCDataWhenNeedsEscape: runPreferCData,
    PreferMarkdownStructure: runPreferMarkdown,
    PreferEmptyElementSelfClosing: runPreferSelfClosing,
    PreferTypeAsTag: runPreferTypeAsTag,
    PreferOmitRedundantType: runPreferOmitRedundantType,
    PreferOmitSubBlockIdentity: runPreferOmitSubBlockIdentity,
};
export function validateStyle(document) {
    const file = document.source.filePath;
    const diagnostics = [];
    for (const rule of loadStyleCatalog()) {
        const run = INTERPRETERS[rule.check];
        if (!run) {
            diagnostics.push({
                severity: "info",
                code: "BML_STYLE_UNKNOWN_CHECK",
                message: `Unknown style check type: ${rule.check}`,
                source: { file, line: 1, column: 1 },
            });
            continue;
        }
        walkBlocks(document.block, "root", (block, role) => {
            run(rule, block, role, file, diagnostics);
        });
    }
    return diagnostics;
}
//# sourceMappingURL=validate-style.js.map