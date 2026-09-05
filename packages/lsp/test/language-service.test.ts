import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "@blockml/parser";
import { analyzeDocument, createWorkspace, diagnosticToLsp } from "../src/index.js";

const ROOT = join(import.meta.dirname, "..", "..", "..");

describe("analyzeDocument", () => {
  it("returns no errors for valid constraint fixture", () => {
    const file = join(
      ROOT,
      "packages/framework/test/constraints/fixtures/valid-min-on-property.bml",
    );
    const text = readFileSync(file, "utf8");
    const workspace = createWorkspace(ROOT);
    const result = analyzeDocument(text, file, workspace);
    const errors = result.diagnostics.filter((d) => d.severity === "error");
    expect(errors).toEqual([]);
  });

  it("reports constraint violation for invalid fixture", () => {
    const file = join(
      ROOT,
      "packages/framework/test/constraints/fixtures/invalid-constraint-violation.bml",
    );
    const text = readFileSync(file, "utf8");
    const workspace = createWorkspace(ROOT);
    const result = analyzeDocument(text, file, workspace);
    expect(
      result.diagnostics.some((d) => d.code === "BML_CONSTRAINT_VIOLATION"),
    ).toBe(true);
  });

  it("places unknown prefix diagnostics on the property line", () => {
    const text = [
      '<block xmlns="http://blockml.org/bml"',
      ' xmlns:core="org.blockml.bml.core"',
      ' xmlns:type="org.blockml.bml.type"',
      ' xmlns:test="com.blockml.test.lsp">',
      "  <type>test:Sample</type>",
      "  <baseType>core:Block</baseType>",
      "  <is>sample</is>",
      "  <properties>",
      '    <count type="foo:Bar" />',
      "  </properties>",
      "</block>",
    ].join("\n");
    const workspace = createWorkspace(ROOT);
    const result = analyzeDocument(text, "unknown-prefix.bml", workspace);
    const diag = result.diagnostics.find((d) => d.code === "BML_UNKNOWN_NAMESPACE_PREFIX");
    expect(diag).toBeDefined();
    expect(diag!.source.line).toBeGreaterThan(1);
    const lsp = diagnosticToLsp(diag!, text);
    expect(lsp.range.start.line).toBeGreaterThan(0);
  });

  it("surfaces unexpected root text from parse diagnostics", () => {
    const text = [
      '<block xmlns="http://blockml.org/bml"',
      ' xmlns:core="org.blockml.bml.core"',
      ' xmlns:type="org.blockml.bml.type"',
      ' xmlns:test="com.blockml.test.lsp">',
      "  <name>Sample</name>",
      "  <type>test:Sample</type>",
      "  <baseType>core:Block</baseType>",
      "  <is>sample</is>",
      "  sds",
      "</block>",
    ].join("\n");
    const workspace = createWorkspace(ROOT);
    const result = analyzeDocument(text, "unexpected-text.bml", workspace);
    const diag = result.diagnostics.find((d) => d.code === "BML_UNEXPECTED_TEXT");
    expect(diag).toBeDefined();
    const textLine = text.split("\n").findIndex((l) => l.includes("sds"));
    expect(diag!.source.line).toBe(textLine + 1);
    const lsp = diagnosticToLsp(diag!, text);
    expect(lsp.range.start).toEqual({ line: textLine, character: 2 });
    expect(lsp.range.end).toEqual({ line: textLine, character: 5 });
  });

  it("overlays the open document without mutating the cached registry", () => {
    const workspace = createWorkspace(ROOT);
    const disk = [
      '<block xmlns="http://blockml.org/bml"',
      ' xmlns:core="org.blockml.bml.core"',
      ' xmlns:test="com.blockml.test.overlay">',
      "  <name>OverlayMe</name>",
      "  <type>test:OverlayMe</type>",
      "  <baseType>core:Block</baseType>",
      "  <is>disk</is>",
      "</block>",
    ].join("\n");
    const buffer = disk.replace(">disk<", ">buffer<");
    const parsed = parse(disk, { filePath: "/proj/blocks/OverlayMe.bml", continueOnError: true });
    expect(parsed.document).not.toBeNull();
    workspace.registry.register(parsed.document!);
    const result = analyzeDocument(buffer, "/proj/blocks/OverlayMe.bml", workspace);
    expect(result.document?.block.is).toBe("buffer");
    expect(workspace.registry.get("com.blockml.test.overlay.OverlayMe")?.block.is).toBe("disk");
  });
});
