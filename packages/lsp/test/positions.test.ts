import { describe, expect, it } from "vitest";
import { bomLocationToRange, bomSeverityToLsp, diagnosticToLsp } from "../src/index.js";

describe("bomLocationToRange", () => {
  it("maps 1-based BOM columns to 0-based LSP positions", () => {
    const text = "line one\nline two\n";
    const range = bomLocationToRange(
      { file: "t.bml", line: 2, column: 3 },
      text,
    );
    expect(range.start).toEqual({ line: 1, character: 2 });
    expect(range.end.character).toBeGreaterThan(range.start.character);
  });

  it("uses endLine and endColumn when present", () => {
    const range = bomLocationToRange({
      file: "t.bml",
      line: 1,
      column: 1,
      endLine: 1,
      endColumn: 5,
    });
    expect(range.start).toEqual({ line: 0, character: 0 });
    expect(range.end).toEqual({ line: 0, character: 4 });
  });

  it("extends to the line end when end span is missing and text is provided", () => {
    const text = "abcdefg\nsecond\n";
    const range = bomLocationToRange({ file: "t.bml", line: 1, column: 1 }, text);
    expect(range.start).toEqual({ line: 0, character: 0 });
    expect(range.end.character).toBe("abcdefg".length + 1);
  });
});

describe("bomSeverityToLsp", () => {
  it("maps severities to LSP numeric codes", () => {
    expect(bomSeverityToLsp("error")).toBe(1);
    expect(bomSeverityToLsp("warning")).toBe(2);
    expect(bomSeverityToLsp("info")).toBe(3);
    expect(bomSeverityToLsp("recommendation")).toBe(4);
  });
});

describe("diagnosticToLsp warning range", () => {
  const text = [
    '<test:Sample xmlns="http://blockml.org/bml"',
    '  xmlns:core="org.blockml.bml.core"',
    '  xmlns:idle="org.blockml.bml.idle"',
    '  xmlns:test="com.blockml.test.style">',
    "  <baseType>core:Block</baseType>",
    "  <is>sample</is>",
    "</test:Sample>",
    "",
  ].join("\n");

  it("shrinks a block-spanning warning to the opening root tag name", () => {
    const lsp = diagnosticToLsp(
      {
        severity: "warning",
        code: "BML_STYLE_UNUSED_NAMESPACE",
        message: "Unused xmlns prefix 'idle'.",
        source: {
          file: "t.bml",
          line: 1,
          column: 1,
          endLine: 7,
          endColumn: 15,
        },
      },
      text,
    );
    expect(lsp.range.start).toEqual({ line: 0, character: 0 });
    expect(lsp.range.end).toEqual({ line: 0, character: "<test:Sample".length });
  });

  it("keeps a targeted warning on its token", () => {
    const lsp = diagnosticToLsp(
      {
        severity: "warning",
        code: "BML_STYLE_EMPTY_ELEMENT_SELF_CLOSE",
        message: "Write empty elements as self-closing tags.",
        source: { file: "t.bml", line: 5, column: 16, endLine: 5, endColumn: 21 },
      },
      text,
    );
    expect(lsp.range.start).toEqual({ line: 4, character: 15 });
    expect(lsp.range.end).toEqual({ line: 4, character: 20 });
  });

  it("does not shrink an error that spans the block", () => {
    const lsp = diagnosticToLsp(
      {
        severity: "error",
        code: "BML_UNKNOWN_TYPE",
        message: "Unknown type",
        source: {
          file: "t.bml",
          line: 1,
          column: 1,
          endLine: 7,
          endColumn: 15,
        },
      },
      text,
    );
    expect(lsp.range.end.line).toBe(6);
  });
});
