import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createWorkspace, hoverAt } from "../src/index.js";

const ROOT = join(import.meta.dirname, "..", "..", "..");

const HOVER_BML = [
  '<block xmlns="http://blockml.org/bml"',
  ' xmlns:core="org.blockml.bml.core"',
  ' xmlns:type="org.blockml.bml.type"',
  ' xmlns:test="com.blockml.test.hover">',
  "  <name>HoverMe</name>",
  "  <type>test:HoverMe</type>",
  "  <baseType>core:Block</baseType>",
  "  <is>hover fixture</is>",
  "  <properties>",
  '    <count type="type:Integer">',
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

describe("hoverAt", () => {
  it("shows the registry type on <baseType>", () => {
    const workspace = createWorkspace(ROOT);
    const info = hoverAt(HOVER_BML, "hover.bml", positionAt(HOVER_BML, "<baseType>"), workspace);
    expect(info).not.toBeNull();
    expect(info!.contents.kind).toBe("markdown");
    expect(info!.contents.value).toContain("org.blockml.bml.core.Block");
    expect(info!.contents.value).toContain("A semantic building block");
  });

  it("shows member name and typeFqn on a property element", () => {
    const workspace = createWorkspace(ROOT);
    const info = hoverAt(HOVER_BML, "hover.bml", positionAt(HOVER_BML, "<count "), workspace);
    expect(info).not.toBeNull();
    expect(info!.contents.value).toContain("count");
    expect(info!.contents.value).toContain("property");
    expect(info!.contents.value).toContain("org.blockml.bml.type.Integer");
  });

  it("returns null outside the document and for invalid XML", () => {
    const workspace = createWorkspace(ROOT);
    const lines = HOVER_BML.split("\n");
    const last = lines[lines.length - 1] ?? "";
    expect(
      hoverAt(
        HOVER_BML,
        "hover.bml",
        { line: lines.length - 1, character: last.length },
        workspace,
      ),
    ).toBeNull();
    expect(hoverAt("<not-a-block>", "hover.bml", { line: 0, character: 0 }, workspace)).toBeNull();
  });
});
