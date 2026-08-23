import { describe, expect, it } from "vitest";
import { offsetRangeToLsp, qnameAt, xmlTokenAt } from "../src/xml-token.js";

const SAMPLE = [
  '<block xmlns="http://blockml.org/bml"',
  ' xmlns:core="org.blockml.bml.core"',
  ' xmlns:type="org.blockml.bml.type">',
  "  <name>HoverMe</name>",
  "  <baseType>core:Block</baseType>",
  "  <properties>",
  '    <count type="TypeReference(core:Block)">',
  "      <documentation>item count</documentation>",
  "    </count>",
  "  </properties>",
  "</block>",
].join("\n");

function positionAt(text: string, needle: string, offsetInNeedle = 1): { line: number; character: number } {
  const idx = text.indexOf(needle);
  if (idx === -1) {
    throw new Error(`needle not found: ${needle}`);
  }
  const before = text.slice(0, idx + offsetInNeedle);
  const lines = before.split("\n");
  return { line: lines.length - 1, character: lines[lines.length - 1]!.length };
}

describe("xmlTokenAt", () => {
  it("hits an element local name, not the surrounding punctuation", () => {
    const token = xmlTokenAt(SAMPLE, positionAt(SAMPLE, "<name>"));
    expect(token?.kind).toBe("elementName");
    expect(token?.text).toBe("name");
    expect(token?.elementLocalName).toBe("name");
  });

  it("hits attribute names and values separately", () => {
    const key = xmlTokenAt(SAMPLE, positionAt(SAMPLE, '<count type="', 8));
    expect(key?.kind).toBe("attributeName");
    expect(key?.text).toBe("type");
    const value = xmlTokenAt(SAMPLE, positionAt(SAMPLE, "TypeReference"));
    expect(value?.kind).toBe("attributeValue");
    expect(value?.text).toContain("TypeReference(core:Block)");
  });

  it("returns null on whitespace between elements", () => {
    const afterName = SAMPLE.indexOf("</name>") + "</name>".length;
    const lines = SAMPLE.slice(0, afterName + 1).split("\n");
    const pos = { line: lines.length - 1, character: lines[lines.length - 1]!.length };
    expect(xmlTokenAt(SAMPLE, pos)).toBeNull();
  });
});

describe("qnameAt", () => {
  it("covers a whole prefix:Local token", () => {
    const token = xmlTokenAt(SAMPLE, positionAt(SAMPLE, "core:Block"));
    expect(token).not.toBeNull();
    const qn = qnameAt(token!, positionAt(SAMPLE, "core:Block"), SAMPLE);
    expect(qn?.text).toBe("core:Block");
    const expected = offsetRangeToLsp(
      SAMPLE,
      SAMPLE.indexOf("core:Block"),
      SAMPLE.indexOf("core:Block") + "core:Block".length,
    );
    expect(qn?.range).toEqual(expected);
  });

  it("picks the inner QName inside a generic application", () => {
    const token = xmlTokenAt(SAMPLE, positionAt(SAMPLE, "(core:Block)"));
    expect(token?.kind).toBe("attributeValue");
    const qn = qnameAt(token!, positionAt(SAMPLE, "(core:Block)", 2), SAMPLE);
    expect(qn?.text).toBe("core:Block");
  });
});
