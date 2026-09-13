import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  BlockDefinition,
  BlockInstance,
  BomDocument,
  CompositionNode,
  CompositionTemplate,
  Diagnostic,
  DiagnosticSeverity,
  DocumentationProseEntry,
  DocumentationReference,
  InstanceConfiguration,
  MemberDefinition,
  MemberValue,
  SourceLocation,
  TypeExpression,
  TypeReferenceEntityInstance,
  UnknownXmlNode,
} from "@blockml/bom";

const MARKDOWN_MIN_LENGTH = 280;

export interface StyleRuleRecord {
  name: string;
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  check: string;
}

const FALLBACK_RULES: StyleRuleRecord[] = [
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

function styleRuleDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..", "blocks/org/blockml/bml/compiler/validator/style/rule");
}

function propertyValue(source: string, name: string): string | undefined {
  const re = new RegExp(`<${name}\\b[\\s\\S]*?<value>([\\s\\S]*?)</value>`);
  return source.match(re)?.[1]?.trim();
}

function checkTypeName(source: string): string | undefined {
  return source.match(/<check>[\s\S]*?<(?:[\w]+:)?(\w+)\s*\/>/)?.[1];
}

let cachedRules: StyleRuleRecord[] | undefined;

function loadStyleCatalog(): StyleRuleRecord[] {
  if (cachedRules) {
    return cachedRules;
  }
  const dir = styleRuleDir();
  if (!existsSync(dir)) {
    cachedRules = FALLBACK_RULES;
    return cachedRules;
  }
  const rules: StyleRuleRecord[] = [];
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith(".bml")) {
      continue;
    }
    const text = readFileSync(join(dir, entry), "utf8");
    const name =
      text.match(/<name>([^<]+)<\/name>/)?.[1]?.trim() ?? entry.replace(/\.bml$/, "");
    const code = propertyValue(text, "code");
    const severity = propertyValue(text, "severity") as DiagnosticSeverity | undefined;
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

function needsCData(text: string): boolean {
  return /[<&]/.test(text);
}

function hasMarkdownStructure(text: string): boolean {
  return (
    /\n\s*\n/.test(text) ||
    /^#{1,6} /m.test(text) ||
    /^(\s*[-*] |\s*\d+\. |\s*• )/m.test(text)
  );
}

function loc(file: string, source?: SourceLocation): SourceLocation {
  return source ?? { file, line: 1, column: 1 };
}

/** Start of an element only — editor warnings must not span the whole block body. */
function startTagOnly(file: string, source?: SourceLocation): SourceLocation {
  const full = loc(file, source);
  return { file: full.file, line: full.line, column: full.column };
}

function styleDiag(
  rule: StyleRuleRecord,
  file: string,
  source?: SourceLocation,
): Diagnostic {
  return {
    severity: rule.severity,
    code: rule.code,
    message: rule.message,
    source: loc(file, source),
  };
}

type DefinitionRole = "root" | "subBlock" | "embedded";

function walkBlocks(
  block: BlockDefinition,
  role: DefinitionRole,
  visit: (b: BlockDefinition, role: DefinitionRole) => void,
): void {
  visit(block, role);
  for (const sub of block.subBlocks) {
    walkBlocks(sub, "subBlock", visit);
  }
  for (const emb of block.embeddedBlocks) {
    walkBlocks(emb, "embedded", visit);
  }
}

function collectReferences(block: BlockDefinition): DocumentationReference[] {
  const refs = [...(block.references ?? [])];
  for (const member of block.members) {
    refs.push(...(member.references ?? []));
  }
  return refs;
}

type StyleInterpreter = (
  rule: StyleRuleRecord,
  block: BlockDefinition,
  role: DefinitionRole,
  file: string,
  out: Diagnostic[],
) => void;

const BML_ANNOTATION = "org.blockml.bml.annotation.BmlAnnotation";
const XSI_NS = "http://www.w3.org/2001/XMLSchema-instance";

type NamespaceUse = {
  prefixes: Set<string>;
  used: Set<string>;
  bindings: Record<string, string>;
};

function addId(used: Set<string>, value?: string): void {
  const trimmed = value?.trim();
  if (trimmed) {
    used.add(trimmed);
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Authored QName prefixes inside a TypeExpression or identifier string. */
function addQNameText(ns: NamespaceUse, text?: string): void {
  const trimmed = text?.trim();
  if (!trimmed) {
    return;
  }
  addId(ns.used, trimmed);
  for (const prefix of Object.keys(ns.bindings)) {
    if (!prefix || ns.prefixes.has(prefix)) {
      continue;
    }
    const re = new RegExp(
      `(?:^|[^A-Za-z0-9_])${escapeRegExp(prefix)}:(?!//)[A-Za-z_*]`,
    );
    if (re.test(trimmed)) {
      ns.prefixes.add(prefix);
    }
  }
}

function addLiteralData(ns: NamespaceUse, data: unknown): void {
  if (typeof data === "string") {
    addQNameText(ns, data);
    return;
  }
  if (Array.isArray(data)) {
    for (const item of data) {
      addLiteralData(ns, item);
    }
    return;
  }
  if (data && typeof data === "object") {
    for (const value of Object.values(data as Record<string, unknown>)) {
      addLiteralData(ns, value);
    }
  }
}

function addMemberValue(ns: NamespaceUse, value?: MemberValue): void {
  if (!value) {
    return;
  }
  switch (value.kind) {
    case "literal":
      addLiteralData(ns, value.value);
      break;
    case "expression":
    case "interpolated":
      addQNameText(ns, value.raw);
      break;
    case "address":
      addQNameText(ns, value.address.raw);
      break;
    default:
      break;
  }
}

function addInstanceConfig(ns: NamespaceUse, config?: InstanceConfiguration): void {
  if (!config) {
    return;
  }
  for (const value of Object.values(config.named ?? {})) {
    addMemberValue(ns, value);
  }
  for (const value of config.positional ?? []) {
    addMemberValue(ns, value);
  }
}

function addEntity(ns: NamespaceUse, entity?: TypeReferenceEntityInstance): void {
  addQNameText(ns, entity?.value);
  addId(ns.used, entity?.typeFqn);
}

function addExpr(ns: NamespaceUse, expr?: TypeExpression): void {
  if (!expr) {
    return;
  }
  switch (expr.kind) {
    case "named":
      addId(ns.used, expr.fqn);
      for (const arg of expr.typeArguments ?? []) {
        addExpr(ns, arg);
      }
      addInstanceConfig(ns, expr.instanceConfiguration);
      break;
    case "union":
      for (const alt of expr.alternatives) {
        addExpr(ns, alt);
      }
      break;
    case "grouped":
      addExpr(ns, expr.expression);
      break;
    case "anonymousStruct":
      for (const field of expr.fields) {
        addExpr(ns, field.type);
      }
      break;
    default:
      break;
  }
}

function addProse(ns: NamespaceUse, entries?: DocumentationProseEntry[]): void {
  for (const prose of entries ?? []) {
    addId(ns.used, prose.namespace);
  }
}

function addUnknown(used: Set<string>, prefixes: Set<string>, nodes?: UnknownXmlNode[]): void {
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

function addBmlAnnotation(ns: NamespaceUse): void {
  ns.used.add(BML_ANNOTATION);
  for (const [prefix, binding] of Object.entries(ns.bindings)) {
    if (prefix && binding === BML_ANNOTATION) {
      ns.prefixes.add(prefix);
    }
  }
}

function addInstance(ns: NamespaceUse, instance: BlockInstance): void {
  addId(ns.used, instance.typeFqn);
  if (
    instance.id !== undefined ||
    instance.version !== undefined ||
    instance.bean !== undefined ||
    instance.scope !== undefined ||
    instance.generics !== undefined
  ) {
    addBmlAnnotation(ns);
  }
  addMemberValue(ns, instance.id);
  addMemberValue(ns, instance.version);
  addMemberValue(ns, instance.bean);
  addQNameText(ns, instance.basePresets);
  addId(ns.used, instance.namespace);
  for (const value of Object.values(instance.memberValues)) {
    addMemberValue(ns, value);
  }
  if (instance.generics) {
    addQNameText(ns, instance.generics.raw);
    for (const arg of instance.generics.arguments ?? []) {
      addExpr(ns, arg);
    }
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

function addComposition(ns: NamespaceUse, composition?: CompositionTemplate): void {
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

function addCompositionNode(ns: NamespaceUse, node: CompositionNode): void {
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

function addMember(ns: NamespaceUse, member: MemberDefinition): void {
  addId(ns.used, member.namespace);
  if (member.generics || member.xmlRendering) {
    addBmlAnnotation(ns);
  }
  if (member.generics) {
    addQNameText(ns, member.generics.raw);
    for (const arg of member.generics.arguments ?? []) {
      addExpr(ns, arg);
    }
  }
  for (const ref of member.references ?? []) {
    addQNameText(ns, ref.type);
    addId(ns.used, ref.languageFqn);
  }
  for (const keyword of member.keywords ?? []) {
    addId(ns.used, keyword.typeFqn);
    addId(ns.used, keyword.languageFqn);
  }
  addProse(ns, member.summaries);
  addProse(ns, member.documentations);
  for (const example of member.examples ?? []) {
    addId(ns.used, example.namespace);
    addId(ns.used, example.contentLanguageFqn);
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
      addExpr(ns, member.type);
      for (const entry of member.values ?? []) {
        addId(ns.used, entry.namespace);
        addMemberValue(ns, entry.value);
      }
      addMemberValue(ns, member.value);
      for (const group of member.groups ?? []) {
        addEntity(ns, group);
      }
      for (const suggestion of member.suggestions ?? []) {
        addInstance(ns, suggestion);
      }
      break;
    case "aggregation":
      addExpr(ns, member.type);
      addComposition(ns, member.composition);
      for (const group of member.groups ?? []) {
        addEntity(ns, group);
      }
      break;
    case "association":
      addExpr(ns, member.type);
      break;
    case "capability":
      addId(ns.used, member.typeFqn);
      addExpr(ns, member.inputType);
      addExpr(ns, member.outputType);
      addId(ns.used, member.implementation?.languageFqn);
      for (const thrown of member.throws ?? []) {
        addEntity(ns, thrown);
      }
      break;
  }
  for (const constraint of member.constraints ?? []) {
    addInstance(ns, constraint);
  }
}

function collectUsedNamespaceTargets(block: BlockDefinition, ns: NamespaceUse): void {
  addId(ns.used, block.type);
  addId(ns.used, block.baseType);
  addExpr(ns, block.baseTypeExpression);
  addEntity(ns, block.language);
  addId(ns.used, block.languageFqn);
  addId(ns.used, block.definitionFqn);
  if (block.generics || block.xmlRendering) {
    addBmlAnnotation(ns);
  }
  if (block.generics) {
    addQNameText(ns, block.generics.raw);
    for (const arg of block.generics.arguments ?? []) {
      addExpr(ns, arg);
    }
  }
  for (const contract of block.contracts ?? []) {
    addEntity(ns, contract);
  }
  for (const generic of block.genericTypes ?? []) {
    addQNameText(ns, generic.baseType);
    addQNameText(ns, generic.defaultType);
  }
  for (const alias of block.aliases ?? []) {
    addId(ns.used, alias.typeFqn);
    addId(ns.used, alias.languageFqn);
  }
  for (const keyword of block.keywords ?? []) {
    addId(ns.used, keyword.typeFqn);
    addId(ns.used, keyword.languageFqn);
  }
  addProse(ns, block.summaries);
  addProse(ns, block.documentations);
  for (const example of block.examples ?? []) {
    addId(ns.used, example.namespace);
    addId(ns.used, example.contentLanguageFqn);
  }
  for (const ref of block.references ?? []) {
    addQNameText(ns, ref.type);
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

function prefixesUsedByTargets(
  bindings: Record<string, string>,
  usedIds: Set<string>,
): Set<string> {
  const used = new Set<string>();
  for (const id of usedIds) {
    const idx = id.indexOf(":");
    if (idx > 0 && !id.includes("://")) {
      const authored = id.slice(0, idx);
      if (authored !== "xmlns" && bindings[authored]) {
        used.add(authored);
      }
    }
    const packageHits: { prefix: string; binding: string }[] = [];
    const exactHits: string[] = [];
    for (const [prefix, binding] of Object.entries(bindings)) {
      if (!prefix) {
        continue;
      }
      if (id.startsWith(`${binding}.`)) {
        packageHits.push({ prefix, binding });
      } else if (id === binding) {
        exactHits.push(prefix);
      }
    }
    if (packageHits.length > 0) {
      let best = packageHits[0]!;
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

function unusedRootPrefixes(document: BomDocument): string[] {
  const bindings = document.source.namespaceBindings ?? {};
  const ns: NamespaceUse = {
    prefixes: new Set<string>(),
    used: new Set<string>(),
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

function runPreferTypeAsTag(
  rule: StyleRuleRecord,
  block: BlockDefinition,
  _role: DefinitionRole,
  file: string,
  out: Diagnostic[],
): void {
  if (block.wrapperForm === "block") {
    out.push(styleDiag(rule, file, startTagOnly(file, block.source)));
  }
}

function runPreferOmitRedundantType(
  rule: StyleRuleRecord,
  block: BlockDefinition,
  _role: DefinitionRole,
  file: string,
  out: Diagnostic[],
): void {
  if (block.wrapperForm === "type" && block.authoredTypeChild) {
    out.push(styleDiag(rule, file, block.typeSource ?? block.source));
  }
}

function runPreferOmitRedundantName(
  rule: StyleRuleRecord,
  block: BlockDefinition,
  _role: DefinitionRole,
  file: string,
  out: Diagnostic[],
): void {
  if (block.wrapperForm === "type" && block.authoredNameChild) {
    out.push(styleDiag(rule, file, startTagOnly(file, block.source)));
  }
}

function runPreferCData(
  rule: StyleRuleRecord,
  block: BlockDefinition,
  _role: DefinitionRole,
  file: string,
  out: Diagnostic[],
): void {
  for (const prose of block.documentations ?? []) {
    if (needsCData(prose.text) && prose.authoredCharacterDataForm !== "cdata") {
      out.push(styleDiag(rule, file, prose.source));
    }
  }
}

function runPreferMarkdown(
  rule: StyleRuleRecord,
  block: BlockDefinition,
  _role: DefinitionRole,
  file: string,
  out: Diagnostic[],
): void {
  for (const prose of block.documentations ?? []) {
    if (prose.text.length > MARKDOWN_MIN_LENGTH && !hasMarkdownStructure(prose.text)) {
      out.push(styleDiag(rule, file, prose.source));
    }
  }
}

function runPreferSelfClosing(
  rule: StyleRuleRecord,
  block: BlockDefinition,
  _role: DefinitionRole,
  file: string,
  out: Diagnostic[],
): void {
  for (const ref of collectReferences(block)) {
    if (ref.context.trim() === "" && ref.authoredEmptyElementForm === "paired") {
      out.push(styleDiag(rule, file, ref.source));
    }
  }
}

function runPreferOmitUnusedNamespace(
  rule: StyleRuleRecord,
  document: BomDocument,
  out: Diagnostic[],
): void {
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

const INTERPRETERS: Record<string, StyleInterpreter> = {
  PreferCDataWhenNeedsEscape: runPreferCData,
  PreferMarkdownStructure: runPreferMarkdown,
  PreferEmptyElementSelfClosing: runPreferSelfClosing,
  PreferTypeAsTag: runPreferTypeAsTag,
  PreferOmitRedundantType: runPreferOmitRedundantType,
  PreferOmitRedundantName: runPreferOmitRedundantName,
};

export function validateStyle(document: BomDocument): Diagnostic[] {
  const file = document.source.filePath;
  const diagnostics: Diagnostic[] = [];
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
