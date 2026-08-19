import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(__dirname, "..");
const blocksRoot = join(pkgRoot, "blocks/org/blockml/bml/bom");
const srcRoot = join(pkgRoot, "src");

const schema = JSON.parse(
  readFileSync(join(__dirname, "fixtures/urmodell-schema.json"), "utf8"),
);

/** TS exports from index.ts — types and runtime functions. */
const TS_TYPE_EXPORTS = [
  "SourceLocation",
  "SourceInfo",
  "XmlTrivia",
  "MemberSectionName",
  "MetadataElementTrivia",
  "XmlNodeKind",
  "CharacterDataForm",
  "XmlRenderingBlock",
  "XmlRenderingMember",
  "DiagnosticSeverity",
  "Diagnostic",
  "BomDocument",
  "TypeReferenceEntityInstance",
  "GenericType",
  "BlockDefinition",
  "KeywordEntry",
  "DocumentationProseEntry",
  "AliasEntry",
  "ChangelogEntry",
  "DocumentationExample",
  "DocumentationReference",
  "TypeExpression",
  "TypeDescriptor",
  "Multiplicity",
  "InstanceConfiguration",
  "NamedTypeReference",
  "UnionTypeExpression",
  "GenericParameterReference",
  "SelfTypeReference",
  "AnonymousStructType",
  "StructField",
  "MemberDefinition",
  "ConstrainableDefinition",
  "MemberDefinitionBase",
  "PropertyDefinition",
  "PropertyValueEntry",
  "AggregationDefinition",
  "AssociationDefinition",
  "CapabilityDefinition",
  "ImplementationBlock",
  "EmbeddedExpression",
  "CompositionTemplate",
  "InstanceAggregationComposition",
  "CompositionNode",
  "BlockInstanceNode",
  "VirtualContainerNode",
  "BlockInstance",
  "DirectiveAttribute",
  "EachDirective",
  "IfDirective",
  "UnlessDirective",
  "WithDirective",
  "WithBinding",
  "MemberValue",
  "LiteralValue",
  "ExpressionValue",
  "AddressValue",
  "Address",
  "ParseResult",
  "SerializeResult",
  "ParseOptions",
  "SerializeOptions",
];

const TS_CAPABILITY_EXPORTS = ["bomEquals", "stripProvenance"];

/** Maps TS interface name → source file relative to src/types */
const TS_FILE_MAP: Record<string, string> = {
  SourceLocation: "common.ts",
  SourceInfo: "common.ts",
  XmlTrivia: "common.ts",
  MemberSectionName: "common.ts",
  MetadataElementTrivia: "common.ts",
  XmlNodeKind: "common.ts",
  CharacterDataForm: "common.ts",
  XmlRenderingBlock: "common.ts",
  XmlRenderingMember: "common.ts",
  DiagnosticSeverity: "common.ts",
  Diagnostic: "common.ts",
  BomDocument: "document.ts",
  TypeReferenceEntityInstance: "block-definition.ts",
  GenericType: "block-definition.ts",
  BlockDefinition: "block-definition.ts",
  KeywordEntry: "block-definition.ts",
  DocumentationProseEntry: "block-definition.ts",
  AliasEntry: "block-definition.ts",
  ChangelogEntry: "block-definition.ts",
  DocumentationExample: "block-definition.ts",
  DocumentationReference: "block-definition.ts",
  TypeExpression: "type-expression.ts",
  TypeDescriptor: "type-expression.ts",
  Multiplicity: "type-expression.ts",
  InstanceConfiguration: "type-expression.ts",
  NamedTypeReference: "type-expression.ts",
  UnionTypeExpression: "type-expression.ts",
  GenericParameterReference: "type-expression.ts",
  SelfTypeReference: "type-expression.ts",
  AnonymousStructType: "type-expression.ts",
  StructField: "type-expression.ts",
  MemberDefinition: "member-definition.ts",
  ConstrainableDefinition: "member-definition.ts",
  MemberDefinitionBase: "member-definition.ts",
  PropertyDefinition: "member-definition.ts",
  PropertyValueEntry: "member-definition.ts",
  AggregationDefinition: "member-definition.ts",
  AssociationDefinition: "member-definition.ts",
  CapabilityDefinition: "member-definition.ts",
  ImplementationBlock: "member-definition.ts",
  EmbeddedExpression: "member-definition.ts",
  CompositionTemplate: "composition.ts",
  InstanceAggregationComposition: "composition.ts",
  CompositionNode: "composition.ts",
  BlockInstanceNode: "composition.ts",
  VirtualContainerNode: "composition.ts",
  BlockInstance: "composition.ts",
  DirectiveAttribute: "composition.ts",
  EachDirective: "composition.ts",
  IfDirective: "composition.ts",
  UnlessDirective: "composition.ts",
  WithDirective: "composition.ts",
  WithBinding: "composition.ts",
  MemberValue: "values.ts",
  LiteralValue: "values.ts",
  ExpressionValue: "values.ts",
  AddressValue: "values.ts",
  Address: "values.ts",
  ParseResult: "api.ts",
  SerializeResult: "api.ts",
  ParseOptions: "api.ts",
  SerializeOptions: "api.ts",
};

/** Interfaces that extend another interface in TS. */
const TS_EXTENDS: Record<string, string> = {
  PropertyDefinition: "MemberDefinitionBase",
  AggregationDefinition: "MemberDefinitionBase",
  AssociationDefinition: "MemberDefinitionBase",
  CapabilityDefinition: "MemberDefinitionBase",
  TypeDescriptor: "TypeExpression",
};

function walkBmlFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...walkBmlFiles(full));
    } else if (entry.endsWith(".bml") && entry !== "Library.bml" && entry !== "README.bml") {
      results.push(full);
    }
  }
  return results;
}

function parseBmlProperties(content: string): { name: string; required: boolean }[] {
  const props: { name: string; required: boolean }[] = [];
  const propRegex = /<(\w+)\s+type="[^"]*">([\s\S]*?)<\/\1>/g;
  let match;
  while ((match = propRegex.exec(content)) !== null) {
    const name = match[1];
    const body = match[2];
    props.push({ name, required: body.includes("(required)") });
  }
  return props;
}

function parseBmlBaseType(content: string): string | null {
  const m = content.match(/<baseType>([^<]+)<\/baseType>/);
  return m ? m[1].trim() : null;
}

function resolveBmlBlockPath(typeRef: string): string | null {
  const prefixMap: Record<string, string> = {
    "bom:": "",
    "bomcommon:": "common",
    "bomvalue:": "value",
    "bomtype:": "type",
    "bomblock:": "block",
    "bommember:": "member",
    "bomcomp:": "composition",
    "bomdoc:": "document",
    "bomapi:": "api",
    "bomcap:": "capability",
    "bomrules:": "rules",
  };
  for (const [prefix, subdir] of Object.entries(prefixMap)) {
    if (typeRef.startsWith(prefix)) {
      const name = typeRef.slice(prefix.length);
      const dir = subdir ? join(blocksRoot, subdir) : blocksRoot;
      const candidate = join(dir, `${name}.bml`);
      return candidate;
    }
  }
  return null;
}

function parseBmlPropertiesWithInheritance(
  bmlPath: string,
  visited = new Set<string>(),
): { name: string; required: boolean }[] {
  if (visited.has(bmlPath)) return [];
  visited.add(bmlPath);

  const content = readFileSync(bmlPath, "utf8");
  const props = parseBmlProperties(content);
  const baseType = parseBmlBaseType(content);

  if (baseType && !baseType.startsWith("core:") && baseType !== "bom:UrmodellType") {
    const basePath = resolveBmlBlockPath(baseType);
    if (basePath) {
      const baseProps = parseBmlPropertiesWithInheritance(basePath, visited);
      const ownNames = new Set(props.map((p) => p.name));
      for (const bp of baseProps) {
        if (!ownNames.has(bp.name)) {
          props.push(bp);
        }
      }
    }
  }

  return props;
}

function parseTsInterfaceFields(filePath: string, interfaceName: string): Map<string, boolean> {
  const content = readFileSync(filePath, "utf8");
  const fields = new Map<string, boolean>();

  const extendsBase = TS_EXTENDS[interfaceName];
  if (extendsBase && TS_FILE_MAP[extendsBase]) {
    const baseFields = parseTsInterfaceFields(
      join(srcRoot, "types", TS_FILE_MAP[extendsBase]),
      extendsBase,
    );
    for (const [k, v] of baseFields) {
      fields.set(k, v);
    }
  }

  const ifaceRegex = new RegExp(`\\binterface\\s+${interfaceName}\\b`);
  const ifaceMatch = content.match(ifaceRegex);
  if (!ifaceMatch || ifaceMatch.index === undefined) {
    return fields;
  }
  const ifaceStart = ifaceMatch.index;

  const braceStart = content.indexOf("{", ifaceStart);
  if (braceStart === -1) {
    return fields;
  }

  let depth = 0;
  let body = "";
  for (let i = braceStart; i < content.length; i++) {
    const ch = content[i];
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        body = content.slice(braceStart + 1, i);
        break;
      }
    }
  }

  const fieldRegex = /^\s*(\w+)(\?)?:\s/gm;
  let fieldMatch;
  while ((fieldMatch = fieldRegex.exec(body)) !== null) {
    fields.set(fieldMatch[1], fieldMatch[2] !== "?");
  }

  return fields;
}

function parseLibraryCatalog(): Set<string> {
  const library = readFileSync(join(blocksRoot, "Library.bml"), "utf8");
  const catalog = new Set<string>();
  const compRegex = /<composition>\s*<(?:[\w]+:)?(\w+)\s*\/?>\s*<\/composition>/g;
  let m;
  while ((m = compRegex.exec(library)) !== null) {
    catalog.add(m[1]);
  }
  return catalog;
}

describe("BOM BML ↔ TS parity", () => {
  it("schema covers all TS type exports", () => {
    const schemaExports = new Set(schema.blocks.map((b: { tsExport: string }) => b.tsExport));
    for (const name of TS_TYPE_EXPORTS) {
      expect(schemaExports.has(name), `schema missing ${name}`).toBe(true);
    }
  });

  it("Library.bml catalog includes all Urmodell blocks", () => {
    const catalog = parseLibraryCatalog();
    const expectedInCatalog = schema.blocks
      .map((b: { tsExport: string }) => b.tsExport)
      .filter((name: string) => name !== "UrmodellType");

    for (const name of expectedInCatalog) {
      expect(catalog.has(name), `Library.bml missing ${name}`).toBe(true);
    }
  });

  it("every TS type export has a BML file", () => {
    const bmlFiles = walkBmlFiles(blocksRoot);
    const bmlNames = new Set(bmlFiles.map((f) => f.split("/").pop()!.replace(".bml", "")));

    for (const name of TS_TYPE_EXPORTS) {
      expect(bmlNames.has(name), `missing BML file for ${name}`).toBe(true);
    }
  });

  it("capabilities are modeled in BML", () => {
    const catalog = parseLibraryCatalog();
    expect(catalog.has("BomEquals")).toBe(true);
    expect(catalog.has("StripProvenance")).toBe(true);
    expect(TS_CAPABILITY_EXPORTS).toEqual(["bomEquals", "stripProvenance"]);
  });

  it("union variants have kind discriminators in schema", () => {
    for (const [union, variants] of Object.entries(schema.unions)) {
      for (const variant of variants as string[]) {
        const block = schema.blocks.find((b: { tsExport: string }) => b.tsExport === variant);
        expect(block, `union ${union} variant ${variant}`).toBeDefined();
        expect(block.kind, `${variant} missing kind`).toBeTruthy();
      }
    }
  });

  it("BML property fields match TS interface fields", () => {
    const bmlFiles = walkBmlFiles(blocksRoot);

    for (const name of TS_TYPE_EXPORTS) {
      if (schema.typeAliases?.[name]) continue;
      if (schema.unions?.[name]) continue;

      const bmlPath = bmlFiles.find((f) => f.endsWith(`/${name}.bml`));
      expect(bmlPath, `BML path for ${name}`).toBeDefined();

      const bmlContent = readFileSync(bmlPath!, "utf8");
      const bmlProps = parseBmlPropertiesWithInheritance(bmlPath!);
      const bmlFieldNames = new Set(bmlProps.map((p) => p.name));

      const tsFile = join(srcRoot, "types", TS_FILE_MAP[name]);
      const tsFields = parseTsInterfaceFields(tsFile, name);

      for (const [fieldName, required] of tsFields) {
        expect(bmlFieldNames.has(fieldName), `${name}.${fieldName} missing in BML`).toBe(true);
        if (required) {
          const bmlProp = bmlProps.find((p) => p.name === fieldName);
          expect(bmlProp?.required, `${name}.${fieldName} should be required in BML`).toBe(true);
        }
      }

      for (const prop of bmlProps) {
        expect(tsFields.has(prop.name), `${name}.${prop.name} in BML but not in TS`).toBe(true);
      }
    }
  });
});
