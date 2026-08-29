import { describe, expect, it } from "vitest";
import type { BlockDefinition, BomDocument } from "@blockml/bom";
import { parse } from "@blockml/parser";
import { TypeRegistry, validateTypes } from "../src/index.js";

function lineOf(source: string, snippet: string): number {
  const idx = source.indexOf(snippet);
  expect(idx).toBeGreaterThanOrEqual(0);
  return source.slice(0, idx).split("\n").length;
}

function typeDoc(block: BlockDefinition): BomDocument {
  return {
    kind: "block",
    source: { format: "xml", filePath: `${block.name}.bml` },
    block,
  };
}

function registerCore(registry: TypeRegistry): void {
  registry.register(
    typeDoc({
      name: "Block",
      type: "org.blockml.bml.core.Block",
      members: [],
      subBlocks: [],
      embeddedBlocks: [],
      compositions: [],
    }),
  );
  registry.register(
    typeDoc({
      name: "Exception",
      type: "org.blockml.bml.core.Exception",
      baseType: "org.blockml.bml.core.Block",
      members: [],
      subBlocks: [],
      embeddedBlocks: [],
      compositions: [],
    }),
  );
  registry.register(
    typeDoc({
      name: "Action",
      type: "org.blockml.bml.capability.Action",
      members: [],
      subBlocks: [],
      embeddedBlocks: [],
      compositions: [],
    }),
  );
  registry.register(
    typeDoc({
      name: "PrerequisiteNotMetException",
      type: "org.blockml.bml.transformer.workflow.PrerequisiteNotMetException",
      baseType: "org.blockml.bml.core.Exception",
      members: [],
      subBlocks: [],
      embeddedBlocks: [],
      compositions: [],
    }),
  );
}

function sample(throwsBody: string): string {
  return [
    '<block xmlns="http://blockml.org/bml"',
    ' xmlns:cap="org.blockml.bml.capability"',
    ' xmlns:core="org.blockml.bml.core"',
    ' xmlns:type="org.blockml.bml.type"',
    ' xmlns:workflow="org.blockml.bml.transformer.workflow"',
    ' xmlns:test="com.blockml.test.throws">',
    "  <type>test:Host</type>",
    "  <baseType>core:Block</baseType>",
    "  <is>host</is>",
    "  <capabilities>",
    '    <satisfy type="cap:Action">',
    throwsBody,
    "    </satisfy>",
    "  </capabilities>",
    "</block>",
  ].join("\n");
}

describe("validateTypes capability throws", () => {
  it("accepts Exception subtypes in throws", () => {
    const source = sample(
      [
        "      <throws>",
        "        <workflow:PrerequisiteNotMetException />",
        "      </throws>",
      ].join("\n"),
    );
    const parsed = parse(source, { filePath: "ok-throws.bml", continueOnError: true });
    expect(parsed.document).not.toBeNull();
    const registry = new TypeRegistry();
    registerCore(registry);
    const diagnostics = validateTypes(parsed.document!, registry);
    expect(diagnostics.some((d) => d.code === "BML_UNKNOWN_TYPE")).toBe(false);
    expect(diagnostics.some((d) => d.code === "BML_TYPE_BOUND_NOT_SATISFIED")).toBe(false);
  });

  it("reports unknown thrown type", () => {
    const source = sample(
      [
        "      <throws>",
        "        <workflow:MissingException />",
        "      </throws>",
      ].join("\n"),
    );
    const parsed = parse(source, { filePath: "unknown-throws.bml", continueOnError: true });
    expect(parsed.document).not.toBeNull();
    const registry = new TypeRegistry();
    registerCore(registry);
    const diagnostics = validateTypes(parsed.document!, registry);
    const diag = diagnostics.find((d) => d.code === "BML_UNKNOWN_TYPE");
    expect(diag).toBeDefined();
    expect(diag!.message).toContain(
      "org.blockml.bml.transformer.workflow.MissingException",
    );
    expect(diag!.source.line).toBe(lineOf(source, "<satisfy"));
  });

  it("reports a known non-Exception in throws", () => {
    const source = sample(
      ["      <throws>", "        <core:Block />", "      </throws>"].join("\n"),
    );
    const parsed = parse(source, { filePath: "bound-throws.bml", continueOnError: true });
    expect(parsed.document).not.toBeNull();
    const registry = new TypeRegistry();
    registerCore(registry);
    const diagnostics = validateTypes(parsed.document!, registry);
    const diag = diagnostics.find((d) => d.code === "BML_TYPE_BOUND_NOT_SATISFIED");
    expect(diag).toBeDefined();
    expect(diag!.message).toContain("org.blockml.bml.core.Block");
    expect(diag!.message).toContain("org.blockml.bml.core.Exception");
  });
});
