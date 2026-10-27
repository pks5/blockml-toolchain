import { beforeAll, describe, expect, it } from "vitest";
import { join } from "node:path";
import type { BomDocument } from "@blockml/bom";
import { parse } from "@blockml/parser";
import {
  bootstrapTypeRegistry,
  defaultBootstrapPaths,
  normalizeParsedMemberValues,
  TypeRegistry,
  validateTypes,
} from "../src/index.js";

const ROOT = join(import.meta.dirname, "..", "..", "..");
const NS = "com.blockml.test.enum";
const COLOR = `${NS}.Color`;

function parseDoc(source: string, filePath: string): BomDocument {
  const parsed = parse(source, { filePath, continueOnError: true });
  expect(parsed.document, parsed.diagnostics.map((d) => d.message).join("\n")).not.toBeNull();
  return parsed.document!;
}

const colorXml = [
  `<test:Color xmlns="http://blockml.org/bml"`,
  ` xmlns:bml="org.blockml.bml.annotation.BmlAnnotation"`,
  ` xmlns:core="org.blockml.bml.core"`,
  ` xmlns:type="org.blockml.bml.type"`,
  ` xmlns:test="${NS}">`,
  `  <baseType>type:EnumType</baseType>`,
  `  <is>color</is>`,
  `  <aggregations>`,
  `    <values override="true">`,
  `      <composition>`,
  `        <test:Color bml:id="Red" />`,
  `        <test:Color bml:id="Blue" />`,
  `      </composition>`,
  `    </values>`,
  `  </aggregations>`,
  `</test:Color>`,
].join("\n");

function sampleXml(value: string): string {
  return [
    `<test:Sample xmlns="http://blockml.org/bml"`,
    ` xmlns:core="org.blockml.bml.core"`,
    ` xmlns:test="${NS}">`,
    `  <baseType>core:Block</baseType>`,
    `  <is>sample</is>`,
    `  <properties>`,
    `    <shade type="test:Color">`,
    `      <value>${value}</value>`,
    `    </shade>`,
    `  </properties>`,
    `</test:Sample>`,
  ].join("\n");
}

describe("enum membership", () => {
  let registry: TypeRegistry;

  beforeAll(() => {
    registry = bootstrapTypeRegistry(defaultBootstrapPaths(ROOT), ROOT).registry;
    registry.register(parseDoc(colorXml, "Color.bml"));
  });

  it("accepts a member id", () => {
    const diagnostics = validateTypes(parseDoc(sampleXml("Red"), "ok.bml"), registry);
    expect(diagnostics.some((d) => d.code === "BML_UNKNOWN_ENUM_VALUE")).toBe(false);
  });

  it("accepts EnumFqn::id", () => {
    const diagnostics = validateTypes(parseDoc(sampleXml(`${COLOR}::Blue`), "qualified.bml"), registry);
    expect(diagnostics.some((d) => d.code === "BML_UNKNOWN_ENUM_VALUE")).toBe(false);
  });

  it("rejects an unknown token", () => {
    const diagnostics = validateTypes(parseDoc(sampleXml("solid"), "bad.bml"), registry);
    const diag = diagnostics.find((d) => d.code === "BML_UNKNOWN_ENUM_VALUE");
    expect(diag?.message).toContain("solid");
    expect(diag?.message).toContain(COLOR);
  });

  it("stores a qualified token as the member id", () => {
    const document = parseDoc(sampleXml(`${COLOR}::Red`), "store.bml");
    registry.register(document);
    normalizeParsedMemberValues(document, registry);
    const shade = document.block.members.find((member) => member.name === "shade");
    expect(shade?.kind).toBe("property");
    if (shade?.kind === "property" && shade.value?.kind === "literal") {
      expect(shade.value.value).toBe("Red");
    }
  });
});
