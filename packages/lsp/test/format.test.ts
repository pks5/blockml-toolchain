import { describe, expect, it } from "vitest";
import { formatDocument } from "../src/index.js";

const COMPACT = [
  '<block xmlns="http://blockml.org/bml"',
  ' xmlns:core="org.blockml.bml.core"',
  ' xmlns:type="org.blockml.bml.type"',
  ' xmlns:test="com.blockml.test.format">',
  "<type>test:FormatMe</type>",
  "<baseType>core:Block</baseType>",
  "<is>format fixture</is>",
  "<version>1.0.0</version>",
  "</block>",
].join("");

describe("formatDocument", () => {
  it("pretty-prints compact parseable BML with indent 2", () => {
    const formatted = formatDocument(COMPACT);
    expect(formatted).not.toBeNull();
    expect(formatted).toContain("\n  <type>");
    expect(formatted).toContain("test:FormatMe");
    expect(formatted?.startsWith("<?xml")).toBe(false);
  });

  it("returns null for invalid XML", () => {
    expect(formatDocument("<not-a-block>")).toBeNull();
  });

  it("preserves a leading XML declaration", () => {
    const withDecl = `<?xml version="1.0" encoding="UTF-8"?>\n${COMPACT}`;
    const formatted = formatDocument(withDecl);
    expect(formatted).not.toBeNull();
    expect(formatted?.startsWith("<?xml version=\"1.0\" encoding=\"UTF-8\"?>")).toBe(true);
  });

  it("is stable when formatting already-canonical text", () => {
    const first = formatDocument(COMPACT);
    expect(first).not.toBeNull();
    const second = formatDocument(first!);
    expect(second).toBe(first);
  });
});
