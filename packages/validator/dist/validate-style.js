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
        name: "OmitRedundantName",
        code: "BML_STYLE_REDUNDANT_NAME",
        severity: "warning",
        message: "Omit child name when the element tag already supplies the name.",
        check: "PreferOmitRedundantName",
    },
    {
        name: "OmitUnusedNamespace",
        code: "BML_STYLE_UNUSED_NAMESPACE",
        severity: "warning",
        message: "Remove unused xmlns prefix declarations from the document root.",
        check: "PreferOmitUnusedNamespace",
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
        const name = text.match(/<name>([^<]+)<\/name>/)?.[1]?.trim() ?? entry.replace(/\.bml$/, "");
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
/** Start of an element only — editor warnings must not span the whole block body. */
function startTagOnly(file, source) {
    const full = loc(file, source);
    return { file: full.file, line: full.line, column: full.column };
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
const BML_ANNOTATION = "org.blockml.bml.annotation.BmlAnnotation";
const XSI_NS = "http://www.w3.org/2001/XMLSchema-instance";
function addId(used, value) {
    const trimmed = value?.trim();
    if (trimmed) {
        used.add(trimmed);
    }
}
function addEntity(used, entity) {
    addId(used, entity?.value);
    addId(used, entity?.typeFqn);
}
function addExpr(used, expr) {
    if (!expr) {
        return;
    }
    switch (expr.kind) {
        case "named":
            addId(used, expr.fqn);
            for (const arg of expr.typeArguments ?? []) {
                addExpr(used, arg);
            }
            break;
        case "union":
            for (const alt of expr.alternatives) {
                addExpr(used, alt);
            }
            break;
        case "grouped":
            addExpr(used, expr.expression);
            break;
        case "anonymousStruct":
            for (const field of expr.fields) {
                addExpr(used, field.type);
            }
            break;
        default:
            break;
    }
}
function addUnknown(used, prefixes, nodes) {
    for (const node of nodes ?? []) {
        if (node.prefix) {
            prefixes.add(node.prefix);
        }
        for (const name of Object.keys(node.attributes)) {
            const idx = name.indexOf(":");
            if (idx > 0 && name.slice(0, idx) !== "xmlns") {
                prefixes.add(name.slice(0, idx));
            }
        }
    }
}
function addBmlAnnotation(ns) {
    ns.used.add(BML_ANNOTATION);
    for (const [prefix, binding] of Object.entries(ns.bindings)) {
        if (prefix && binding === BML_ANNOTATION) {
            ns.prefixes.add(prefix);
        }
    }
}
function addInstance(ns, instance) {
    addId(ns.used, instance.typeFqn);
    if (instance.id !== undefined ||
        instance.version !== undefined ||
        instance.bean !== undefined ||
        instance.scope !== undefined ||
        instance.generics !== undefined) {
        addBmlAnnotation(ns);
    }
    for (const name of Object.keys(instance.unknownAttributes ?? {})) {
        const idx = name.indexOf(":");
        if (idx > 0) {
            ns.prefixes.add(name.slice(0, idx));
        }
    }
    for (const nested of instance.aggregationCompositions ?? []) {
        addComposition(ns, nested.composition);
    }
}
function addComposition(ns, composition) {
    if (!composition) {
        return;
    }
    if (composition.directives?.length || composition.generics) {
        addBmlAnnotation(ns);
    }
    for (const child of composition.children) {
        addCompositionNode(ns, child);
    }
}
function addCompositionNode(ns, node) {
    if (node.kind === "blockInstance") {
        if (node.directives?.length) {
            addBmlAnnotation(ns);
        }
        addInstance(ns, node.instance);
        return;
    }
    if (node.directives?.length || node.generics) {
        addBmlAnnotation(ns);
    }
    for (const child of node.children) {
        addCompositionNode(ns, child);
    }
}
function addMember(ns, member) {
    addId(ns.used, member.namespace);
    if (member.generics || member.xmlRendering) {
        addBmlAnnotation(ns);
    }
    for (const ref of member.references ?? []) {
        addId(ns.used, ref.type);
        addId(ns.used, ref.languageFqn);
    }
    for (const keyword of member.keywords ?? []) {
        addId(ns.used, keyword.typeFqn);
        addId(ns.used, keyword.languageFqn);
    }
    for (const prose of member.documentations ?? []) {
        addId(ns.used, prose.namespace);
    }
    addUnknown(ns.used, ns.prefixes, member.unknownElements);
    for (const name of Object.keys(member.unknownAttributes ?? {})) {
        const idx = name.indexOf(":");
        if (idx > 0) {
            ns.prefixes.add(name.slice(0, idx));
        }
    }
    switch (member.kind) {
        case "property":
            addId(ns.used, member.typeFqn);
            addExpr(ns.used, member.type);
            for (const entry of member.values ?? []) {
                addId(ns.used, entry.namespace);
            }
            for (const group of member.groups ?? []) {
                addEntity(ns.used, group);
            }
            for (const suggestion of member.suggestions ?? []) {
                addInstance(ns, suggestion);
            }
            break;
        case "aggregation":
            addExpr(ns.used, member.type);
            addComposition(ns, member.composition);
            for (const group of member.groups ?? []) {
                addEntity(ns.used, group);
            }
            break;
        case "association":
            addExpr(ns.used, member.type);
            break;
        case "capability":
            addId(ns.used, member.typeFqn);
            addExpr(ns.used, member.inputType);
            addExpr(ns.used, member.outputType);
            addId(ns.used, member.implementation?.languageFqn);
            for (const thrown of member.throws ?? []) {
                addEntity(ns.used, thrown);
            }
            break;
    }
    for (const constraint of member.constraints ?? []) {
        addInstance(ns, constraint);
    }
}
function collectUsedNamespaceTargets(block, ns) {
    addId(ns.used, block.type);
    addId(ns.used, block.baseType);
    addExpr(ns.used, block.baseTypeExpression);
    addEntity(ns.used, block.language);
    addId(ns.used, block.languageFqn);
    addId(ns.used, block.definitionFqn);
    if (block.generics || block.xmlRendering) {
        addBmlAnnotation(ns);
    }
    for (const contract of block.contracts ?? []) {
        addEntity(ns.used, contract);
    }
    for (const generic of block.genericTypes ?? []) {
        addId(ns.used, generic.baseType);
        addId(ns.used, generic.defaultType);
    }
    for (const alias of block.aliases ?? []) {
        addId(ns.used, alias.typeFqn);
        addId(ns.used, alias.languageFqn);
    }
    for (const keyword of block.keywords ?? []) {
        addId(ns.used, keyword.typeFqn);
        addId(ns.used, keyword.languageFqn);
    }
    for (const prose of block.documentations ?? []) {
        addId(ns.used, prose.namespace);
    }
    for (const example of block.examples ?? []) {
        addId(ns.used, example.namespace);
        addId(ns.used, example.contentLanguageFqn);
    }
    for (const ref of block.references ?? []) {
        addId(ns.used, ref.type);
        addId(ns.used, ref.languageFqn);
    }
    addUnknown(ns.used, ns.prefixes, block.unknownElements);
    for (const name of Object.keys(block.unknownAttributes ?? {})) {
        const idx = name.indexOf(":");
        if (idx > 0) {
            ns.prefixes.add(name.slice(0, idx));
        }
    }
    for (const member of block.members) {
        addMember(ns, member);
    }
    for (const composition of block.compositions) {
        addComposition(ns, composition);
    }
    for (const constraint of block.constraints ?? []) {
        addInstance(ns, constraint);
    }
    for (const sub of block.subBlocks) {
        collectUsedNamespaceTargets(sub, ns);
    }
    for (const embedded of block.embeddedBlocks) {
        collectUsedNamespaceTargets(embedded, ns);
    }
}
function prefixesUsedByTargets(bindings, usedIds) {
    const used = new Set();
    for (const id of usedIds) {
        const idx = id.indexOf(":");
        if (idx > 0 && !id.includes("://")) {
            const authored = id.slice(0, idx);
            if (authored !== "xmlns" && bindings[authored]) {
                used.add(authored);
            }
        }
        const packageHits = [];
        const exactHits = [];
        for (const [prefix, binding] of Object.entries(bindings)) {
            if (!prefix) {
                continue;
            }
            if (id.startsWith(`${binding}.`)) {
                packageHits.push({ prefix, binding });
            }
            else if (id === binding) {
                exactHits.push(prefix);
            }
        }
        if (packageHits.length > 0) {
            let best = packageHits[0];
            for (const hit of packageHits) {
                if (hit.binding.length > best.binding.length) {
                    best = hit;
                }
            }
            used.add(best.prefix);
            continue;
        }
        for (const prefix of exactHits) {
            used.add(prefix);
        }
    }
    return used;
}
function unusedRootPrefixes(document) {
    const bindings = document.source.namespaceBindings ?? {};
    const ns = {
        prefixes: new Set(),
        used: new Set(),
        bindings,
    };
    collectUsedNamespaceTargets(document.block, ns);
    if (document.source.schemaLocation || document.source.noNamespaceSchemaLocation) {
        ns.used.add(XSI_NS);
    }
    for (const prefix of prefixesUsedByTargets(bindings, ns.used)) {
        ns.prefixes.add(prefix);
    }
    return Object.keys(bindings)
        .filter((prefix) => prefix !== "" && !ns.prefixes.has(prefix))
        .sort();
}
function runPreferTypeAsTag(rule, block, _role, file, out) {
    if (block.wrapperForm === "block") {
        out.push(styleDiag(rule, file, startTagOnly(file, block.source)));
    }
}
function runPreferOmitRedundantType(rule, block, _role, file, out) {
    if (block.wrapperForm === "type" && block.authoredTypeChild) {
        out.push(styleDiag(rule, file, block.typeSource ?? block.source));
    }
}
function runPreferOmitRedundantName(rule, block, _role, file, out) {
    if (block.wrapperForm === "type" && block.authoredNameChild) {
        out.push(styleDiag(rule, file, startTagOnly(file, block.source)));
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
function runPreferOmitUnusedNamespace(rule, document, out) {
    const file = document.source.filePath;
    for (const prefix of unusedRootPrefixes(document)) {
        out.push({
            severity: rule.severity,
            code: rule.code,
            message: `Unused xmlns prefix '${prefix}'.`,
            source: startTagOnly(file, document.block.source),
        });
    }
}
const INTERPRETERS = {
    PreferCDataWhenNeedsEscape: runPreferCData,
    PreferMarkdownStructure: runPreferMarkdown,
    PreferEmptyElementSelfClosing: runPreferSelfClosing,
    PreferTypeAsTag: runPreferTypeAsTag,
    PreferOmitRedundantType: runPreferOmitRedundantType,
    PreferOmitRedundantName: runPreferOmitRedundantName,
};
export function validateStyle(document) {
    const file = document.source.filePath;
    const diagnostics = [];
    for (const rule of loadStyleCatalog()) {
        if (rule.check === "PreferOmitUnusedNamespace") {
            runPreferOmitUnusedNamespace(rule, document, diagnostics);
            continue;
        }
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