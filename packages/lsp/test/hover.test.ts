import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "@blockml/parser";
import { resolveEffectiveMembers } from "@blockml/framework";
import { createWorkspace, hoverAt } from "../src/index.js";
import { offsetRangeToLsp } from "../src/xml-token.js";

const ROOT = join(import.meta.dirname, "..", "..", "..");
const ROOT_DEF = "org.blockml.bml.definition.RootBlockDefinition";
const PROPERTY_DEF = "org.blockml.bml.definition.PropertyDefinition";

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

const HOVER_UNQUALIFIED_BML = [
  '<block xmlns="http://blockml.org/bml"',
  ' xmlns:core="org.blockml.bml.core"',
  ' xmlns:test="com.blockml.test.hover">',
  "  <name>HoverMe</name>",
  "  <type>test:HoverMe</type>",
  "  <baseType>core:Block</baseType>",
  "  <properties>",
  '    <count type="Integer">',
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

function rangeOf(text: string, needle: string) {
  const idx = text.indexOf(needle);
  if (idx === -1) {
    throw new Error(`needle not found: ${needle}`);
  }
  return offsetRangeToLsp(text, idx, idx + needle.length);
}

function memberProse(workspace: ReturnType<typeof createWorkspace>, metaFqn: string, name: string): string | undefined {
  const block = workspace.registry.get(metaFqn)?.block;
  if (!block) {
    return undefined;
  }
  const member = resolveEffectiveMembers(block, workspace.registry).find((entry) => entry.name === name);
  return member?.documentations?.[0]?.text?.trim() ?? member?.summaries?.[0]?.text?.trim();
}

describe("hoverAt", () => {
  it("returns null between elements", () => {
    const workspace = createWorkspace(ROOT);
    const afterName = HOVER_BML.indexOf("</name>") + "</name>".length;
    const pos = offsetRangeToLsp(HOVER_BML, afterName, afterName + 1).start;
    expect(hoverAt(HOVER_BML, "hover.bml", pos, workspace)).toBeNull();
  });

  it("shows definition-member docs on <name> and <is>, not the document is-text", () => {
    const workspace = createWorkspace(ROOT);
    const nameInfo = hoverAt(HOVER_BML, "hover.bml", positionAt(HOVER_BML, "<name>"), workspace);
    expect(nameInfo).not.toBeNull();
    expect(nameInfo!.contents.value).toContain("**name**");
    expect(nameInfo!.contents.value).toContain(ROOT_DEF);
    expect(nameInfo!.contents.value).not.toContain("hover fixture");
    const nameProse = memberProse(workspace, ROOT_DEF, "name");
    if (nameProse) {
      expect(nameInfo!.contents.value).toContain(nameProse);
    }

    const isInfo = hoverAt(HOVER_BML, "hover.bml", positionAt(HOVER_BML, "<is>"), workspace);
    expect(isInfo).not.toBeNull();
    expect(isInfo!.contents.value).toContain("**is**");
    expect(isInfo!.contents.value).toContain(ROOT_DEF);
    expect(isInfo!.contents.value).not.toContain("A semantic building block");
  });

  it("shows language docs on the <baseType> tag and target docs on the QName", () => {
    const workspace = createWorkspace(ROOT);
    const tag = hoverAt(HOVER_BML, "hover.bml", positionAt(HOVER_BML, "<baseType>"), workspace);
    expect(tag).not.toBeNull();
    expect(tag!.contents.value).toContain("**baseType**");
    expect(tag!.contents.value).toContain(ROOT_DEF);
    expect(tag!.contents.value).not.toContain("A semantic building block");

    const qname = hoverAt(HOVER_BML, "hover.bml", positionAt(HOVER_BML, "core:Block"), workspace);
    expect(qname).not.toBeNull();
    expect(qname!.contents.kind).toBe("markdown");
    expect(qname!.contents.value).toContain("org.blockml.bml.core.Block");
    expect(qname!.contents.value).toContain("A semantic building block");
    expect(qname!.range).toEqual(rangeOf(HOVER_BML, "core:Block"));
  });

  it("shows member docs on <count>, PropertyDefinition on type=, and Integer on the value", () => {
    const workspace = createWorkspace(ROOT);
    const member = hoverAt(HOVER_BML, "hover.bml", positionAt(HOVER_BML, "<count "), workspace);
    expect(member).not.toBeNull();
    expect(member!.contents.value).toContain("count");
    expect(member!.contents.value).toContain("property");
    expect(member!.contents.value).toContain("org.blockml.bml.type.Integer");
    expect(member!.contents.value).toContain("item count");

    const key = hoverAt(HOVER_BML, "hover.bml", positionAt(HOVER_BML, '<count type="', 8), workspace);
    expect(key).not.toBeNull();
    expect(key!.contents.value).toContain("**type**");
    expect(key!.contents.value).toContain(PROPERTY_DEF);
    const typeProse = memberProse(workspace, PROPERTY_DEF, "type");
    if (typeProse) {
      expect(key!.contents.value).toContain(typeProse);
    }

    const value = hoverAt(HOVER_BML, "hover.bml", positionAt(HOVER_BML, "type:Integer"), workspace);
    expect(value).not.toBeNull();
    expect(value!.contents.value).toContain("org.blockml.bml.type.Integer");
    expect(value!.range).toEqual(rangeOf(HOVER_BML, "type:Integer"));
  });

  it("shows Integer docs on unqualified type=Integer, not PropertyDefinition.type", () => {
    const workspace = createWorkspace(ROOT);
    const value = hoverAt(
      HOVER_UNQUALIFIED_BML,
      "hover.bml",
      positionAt(HOVER_UNQUALIFIED_BML, "Integer"),
      workspace,
    );
    expect(value).not.toBeNull();
    expect(value!.contents.value).toContain("org.blockml.bml.type.Integer");
    expect(value!.contents.value).not.toContain("**type**");
    expect(value!.contents.value).not.toContain(PROPERTY_DEF);
    expect(value!.range).toEqual(rangeOf(HOVER_UNQUALIFIED_BML, "Integer"));
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

  it("hovers the open buffer is-text when the disk registry has an older copy", () => {
    const workspace = createWorkspace(ROOT);
    const disk = HOVER_BML.replace(">hover fixture<", ">disk fixture<");
    const parsed = parse(disk, { filePath: "/proj/blocks/HoverMe.bml", continueOnError: true });
    expect(parsed.document).not.toBeNull();
    workspace.registry.register(parsed.document!);
    const info = hoverAt(
      HOVER_BML,
      "/proj/blocks/HoverMe.bml",
      positionAt(HOVER_BML, "test:HoverMe"),
      workspace,
    );
    expect(info).not.toBeNull();
    expect(info!.contents.value).toContain("hover fixture");
    expect(info!.contents.value).not.toContain("disk fixture");
    expect(workspace.registry.get("com.blockml.test.hover.HoverMe")?.block.is).toBe("disk fixture");
  });
});
