import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  BlockDefinition,
  BomDocument,
  Diagnostic,
  DiagnosticSeverity,
  DocumentationReference,
  SourceLocation,
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
    name: "OmitSubBlockIdentity",
    code: "BML_STYLE_REDUNDANT_SUBBLOCK_IDENTITY",
    severity: "warning",
    message:
      "Omit child name and type on preferred-form Sub-Blocks; the tag is the name and the type is derived.",
    check: "PreferOmitSubBlockIdentity",
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
    const name = text.match(/<name>([^<]+)<\/name>/)?.[1]?.trim();
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

function runPreferTypeAsTag(
  rule: StyleRuleRecord,
  block: BlockDefinition,
  _role: DefinitionRole,
  file: string,
  out: Diagnostic[],
): void {
  if (block.wrapperForm === "block") {
    out.push(styleDiag(rule, file, block.source));
  }
}

function runPreferOmitRedundantType(
  rule: StyleRuleRecord,
  block: BlockDefinition,
  role: DefinitionRole,
  file: string,
  out: Diagnostic[],
): void {
  if (block.wrapperForm === "type" && role !== "subBlock" && block.authoredTypeChild) {
    out.push(styleDiag(rule, file, block.typeSource ?? block.source));
  }
}

function runPreferOmitSubBlockIdentity(
  rule: StyleRuleRecord,
  block: BlockDefinition,
  role: DefinitionRole,
  file: string,
  out: Diagnostic[],
): void {
  if (
    role === "subBlock" &&
    block.wrapperForm === "type" &&
    (block.authoredNameChild || block.authoredTypeChild)
  ) {
    out.push(styleDiag(rule, file, block.source));
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

const INTERPRETERS: Record<string, StyleInterpreter> = {
  PreferCDataWhenNeedsEscape: runPreferCData,
  PreferMarkdownStructure: runPreferMarkdown,
  PreferEmptyElementSelfClosing: runPreferSelfClosing,
  PreferTypeAsTag: runPreferTypeAsTag,
  PreferOmitRedundantType: runPreferOmitRedundantType,
  PreferOmitSubBlockIdentity: runPreferOmitSubBlockIdentity,
};

export function validateStyle(document: BomDocument): Diagnostic[] {
  const file = document.source.filePath;
  const diagnostics: Diagnostic[] = [];
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
