import { describe, expect, it } from "vitest";
import { bomLocationToRange, bomSeverityToLsp } from "../src/index.js";

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
  });
});
