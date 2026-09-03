import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { documentationBlocks } from "../scripts/framework-documentation-blocks.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(__dirname, "..");
const blocksRoot = join(pkgRoot, "blocks/org/blockml/bml/framework");
const srcRoot = join(pkgRoot, "src");

const EXPECTED_DOC_BLOCKS = documentationBlocks.map((d) => d.name);

const schema = JSON.parse(
  readFileSync(join(__dirname, "fixtures/framework-schema.json"), "utf8"),
);

/** TS type exports from index.ts that map to FrameworkType blocks. */
const TS_TYPE_EXPORTS = [
  "BootstrapResult",
  "BootstrapTrace",
  "BootstrapOptions",
  "ExpressionNode",
  "InterpolatedStringNode",
  "ParseExpressionResult",
  "ParseExpressionOutcome",
];

const TS_CAPABILITY_EXPORTS = [
  "TypeRegistry",
  "bootstrapTypeRegistry",
  "defaultBootstrapPaths",
  "resolveLibrarySeeds",
  "forkBom",
  "resolveEffectiveMembers",
  "resolveContracts",
  "collectBaseTypeChain",
  "memberIdentityKey",
  "parseExpression",
  "parseInterpolatedText",
  "evaluateExpression",
  "evaluateInterpolatedText",
  "validateTypes",
  "validateEmbeddedBlocks",
  "validateVersions",
  "validateInstances",
  "validateGenerics",
  "validatePresets",
  "validateVisibility",
  "validateReadOnly",
  "validateConstraints",
  "rootFqnByFilePath",
  "rootFqns",
  "getExportedFqns",
  "peekLibraryTypeFqn",
  "getPropertyNumericValue",
  "isLiteralValue",
  "projectSourceRoots",
  "projectLibraryPackageRoots",
  "projectLibraryPackageDirs",
  "registryFilesUnderRoots",
  "bootstrapFullProjectRegistry",
];

const TS_FILE_MAP: Record<string, string> = {
  BootstrapResult: "registry/bootstrap.ts",
  BootstrapTrace: "registry/bootstrap.ts",
  BootstrapOptions: "registry/bootstrap.ts",
  ParseExpressionResult: "expression/types.ts",
  ParseExpressionOutcome: "expression/types.ts",
  InterpolatedStringNode: "expression/types.ts",
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

function parseLibraryCatalog(): Set<string> {
  const library = readFileSync(join(blocksRoot, "Library.bml"), "utf8");
  const catalog = new Set<string>();
  const blocksSection = library.match(/<blocks>([\s\S]*?)<\/blocks>/)?.[1] ?? library;
  const compRegex = /<(?:[\w]+:)?(\w+)\s*\/>/g;
  let m;
  while ((m = compRegex.exec(blocksSection)) !== null) {
    catalog.add(m[1]);
  }
  return catalog;
}

function parseTsInterfaceFields(filePath: string, interfaceName: string): Map<string, boolean> {
  const content = readFileSync(filePath, "utf8");
  const fields = new Map<string, boolean>();

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

function listExportedFunctionsFromIndex(): string[] {
  const content = readFileSync(join(srcRoot, "index.ts"), "utf8");
  const exports: string[] = [];
  const fnRegex = /export\s*\{\s*([^}]+)\s*\}\s*from/g;
  let m;
  while ((m = fnRegex.exec(content)) !== null) {
    for (const part of m[1].split(",")) {
      const name = part.trim().split(/\s+/).pop();
      if (name && /^[a-z]/.test(name)) {
        exports.push(name);
      }
    }
  }
  return exports.sort();
}

function readDiagnosticCodesFromSrc(): string[] {
  const codes = new Set<string>();
  for (const rel of [
    "validate/validate-types.ts",
    "validate/validate-constraints.ts",
    "validate/validate-versions.ts",
    "validate/validate-embedded-blocks.ts",
    "validate/validate-instances.ts",
    "validate/validate-generics.ts",
    "resolve/resolve-generic-application.ts",
    "validate/validate-presets.ts",
    "validate/validate-visibility.ts",
    "validate/validate-readonly.ts",
    "registry/bootstrap.ts",
    "registry/library-bootstrap.ts",
  ]) {
    const content = readFileSync(join(srcRoot, rel), "utf8");
    const codeRegex = /"((?:BML_[A-Z0-9_]+))"/g;
    let m;
    while ((m = codeRegex.exec(content)) !== null) {
      codes.add(m[1]);
    }
  }
  return [...codes].sort();
}

describe("Framework BML ↔ TS parity", () => {
  it("schema covers exported type blocks", () => {
    const schemaExports = new Set(schema.blocks.map((b: { tsExport: string }) => b.tsExport));
    for (const name of TS_TYPE_EXPORTS) {
      expect(schemaExports.has(name), `schema missing ${name}`).toBe(true);
    }
  });

  it("Library.bml catalog includes all blocks", () => {
    const catalog = parseLibraryCatalog();
    for (const b of schema.blocks) {
      if (b.abstract) continue;
      expect(catalog.has(b.tsExport), `Library.bml missing ${b.tsExport}`).toBe(true);
    }
    for (const c of schema.capabilities) {
      expect(catalog.has(c.name), `Library.bml missing capability ${c.name}`).toBe(true);
    }
    for (const name of EXPECTED_DOC_BLOCKS) {
      expect(catalog.has(name), `Library.bml missing documentation ${name}`).toBe(true);
    }
  });

  it("every exported TS type has a BML file", () => {
    const bmlFiles = walkBmlFiles(blocksRoot);
    const bmlNames = new Set(bmlFiles.map((f) => f.split("/").pop()!.replace(".bml", "")));

    for (const name of TS_TYPE_EXPORTS) {
      expect(bmlNames.has(name), `missing BML file for ${name}`).toBe(true);
    }
  });

  it("capabilities match public TS exports", () => {
    const schemaCaps = new Set(
      schema.capabilities.map((c: { tsExport: string }) => c.tsExport),
    );
    for (const fn of TS_CAPABILITY_EXPORTS) {
      expect(schemaCaps.has(fn), `schema missing capability for ${fn}`).toBe(true);
    }
  });

  it("index.ts exported functions have a capability", () => {
    const indexFns = listExportedFunctionsFromIndex();
    const schemaCaps = new Set(
      schema.capabilities.map((c: { tsExport: string }) => c.tsExport),
    );
    for (const fn of indexFns) {
      expect(schemaCaps.has(fn), `missing capability for function ${fn}`).toBe(true);
    }
  });

  it("documentation blocks extend core:Documentation", () => {
    const docDir = join(blocksRoot, "documentation");
    for (const name of EXPECTED_DOC_BLOCKS) {
      expect(
        readFileSync(join(docDir, `${name}.bml`), "utf8").includes("core:Documentation"),
        `${name}.bml should extend core:Documentation`,
      ).toBe(true);
    }
  });

  it("BootstrapResult BML properties match TS interface", () => {
    const bmlPath = join(blocksRoot, "registry/BootstrapResult.bml");
    const bmlProps = parseBmlProperties(readFileSync(bmlPath, "utf8"));
    const bmlFieldNames = new Set(bmlProps.map((p) => p.name));

    const tsFields = parseTsInterfaceFields(
      join(srcRoot, TS_FILE_MAP.BootstrapResult),
      "BootstrapResult",
    );

    for (const [fieldName, required] of tsFields) {
      expect(bmlFieldNames.has(fieldName), `BootstrapResult.${fieldName} missing in BML`).toBe(true);
      if (required) {
        const bmlProp = bmlProps.find((p) => p.name === fieldName);
        expect(bmlProp?.required, `BootstrapResult.${fieldName} should be required in BML`).toBe(
          true,
        );
      }
    }
  });

  it("ParseExpressionResult BML properties match TS interface", () => {
    const bmlPath = join(blocksRoot, "expression/ParseExpressionResult.bml");
    const bmlProps = parseBmlProperties(readFileSync(bmlPath, "utf8"));
    const bmlFieldNames = new Set(bmlProps.map((p) => p.name));

    const tsFields = parseTsInterfaceFields(
      join(srcRoot, TS_FILE_MAP.ParseExpressionResult),
      "ParseExpressionResult",
    );

    for (const [fieldName, required] of tsFields) {
      expect(
        bmlFieldNames.has(fieldName),
        `ParseExpressionResult.${fieldName} missing in BML`,
      ).toBe(true);
      if (required) {
        const bmlProp = bmlProps.find((p) => p.name === fieldName);
        expect(
          bmlProp?.required,
          `ParseExpressionResult.${fieldName} should be required in BML`,
        ).toBe(true);
      }
    }
  });

  it("FrameworkDiagnosticCodes match TS source codes", () => {
    const tsCodes = readDiagnosticCodesFromSrc();
    expect(schema.frameworkDiagnosticCodes.sort()).toEqual(tsCodes);
  });

  it("Library depends on blockml, bom, and parser libraries", () => {
    const library = readFileSync(join(blocksRoot, "Library.bml"), "utf8");
    expect(library).toContain("<blockml:Library />");
    expect(library).toContain("<bom:Library />");
    expect(library).toContain("<parser:Library />");
    expect(library).toContain("<version>0.9.0</version>");
  });

  it("does not redefine BOM API types", () => {
    const bmlFiles = walkBmlFiles(blocksRoot);
    const names = bmlFiles.map((f) => f.split("/").pop()!.replace(".bml", ""));
    expect(names).not.toContain("ValidateOptions");
    expect(names).not.toContain("ValidateResult");
    expect(names).not.toContain("TypeRegistryReader");
    expect(names).not.toContain("BomDocument");
  });
});
