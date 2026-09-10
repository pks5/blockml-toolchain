import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "@blockml/parser";
import { bomLocationToRange, createWorkspace, definitionAt, referencesAt } from "../src/index.js";
import type { LspLocation } from "../src/index.js";
import type { WorkspaceState } from "../src/workspace.js";
import { offsetRangeToLsp } from "../src/xml-token.js";

const ROOT = join(import.meta.dirname, "..", "..", "..");
const CORE_BLOCK = "org.blockml.bml.core.Block";

const NAV_BML = [
  '<block xmlns="http://blockml.org/bml"',
  ' xmlns:core="org.blockml.bml.core"',
  ' xmlns:type="org.blockml.bml.type"',
  ' xmlns:test="com.blockml.test.nav">',
  "  <name>NavMe</name>",
  "  <type>test:NavMe</type>",
  "  <baseType>core:Block</baseType>",
  "  <is>navigation fixture</is>",
  "  <properties>",
  '    <count type="type:Integer">',
  "      <documentation>item count</documentation>",
  "    </count>",
  "  </properties>",
  "</block>",
].join("\n");

const NAV_NS = [
  'xmlns="http://blockml.org/bml"',
  ' xmlns:core="org.blockml.bml.core"',
  ' xmlns:type="org.blockml.bml.type"',
  ' xmlns:test="com.blockml.test.navmember"',
].join("");

const NAV_PARENT_BML = [
  `<block ${NAV_NS}>`,
  "  <name>NavParent</name>",
  "  <type>test:NavParent</type>",
  "  <baseType>core:Block</baseType>",
  "  <is>nav parent</is>",
  "  <properties>",
  '    <label type="type:Text">',
  "      <documentation>parent label</documentation>",
  "    </label>",
  "  </properties>",
  "</block>",
].join("\n");

const NAV_MID_BML = [
  `<block ${NAV_NS}>`,
  "  <name>NavMid</name>",
  "  <type>test:NavMid</type>",
  "  <baseType>test:NavParent</baseType>",
  "  <is>nav mid</is>",
  "  <properties>",
  '    <label override="true" type="type:Text">',
  "      <documentation>mid label</documentation>",
  "    </label>",
  "  </properties>",
  "</block>",
].join("\n");

const NAV_TARGET_PARENT_BML = [
  `<block ${NAV_NS}>`,
  "  <name>NavTargetParent</name>",
  "  <type>test:NavTargetParent</type>",
  "  <baseType>core:Block</baseType>",
  "  <is>instance parent</is>",
  "  <properties>",
  '    <inheritedProp type="type:Integer" />',
  "  </properties>",
  "</block>",
].join("\n");

const NAV_INNER_BML = [
  `<block ${NAV_NS}>`,
  "  <name>NavInner</name>",
  "  <type>test:NavInner</type>",
  "  <baseType>core:Block</baseType>",
  "  <is>nested instance</is>",
  "  <properties>",
  '    <someProp type="type:Integer" />',
  "  </properties>",
  "</block>",
].join("\n");

const NAV_TARGET_BML = [
  `<block ${NAV_NS}>`,
  "  <name>NavTarget</name>",
  "  <type>test:NavTarget</type>",
  "  <baseType>test:NavTargetParent</baseType>",
  "  <is>composition instance type</is>",
  "  <properties>",
  '    <myProp type="type:Integer" />',
  '    <otherProp type="type:Integer" />',
  "  </properties>",
  "  <aggregations>",
  '    <myAggr type="test:NavInner[]" />',
  "  </aggregations>",
  "</block>",
].join("\n");

const NAV_CHILD_BML = [
  `<block ${NAV_NS}>`,
  "  <name>NavChild</name>",
  "  <type>test:NavChild</type>",
  "  <baseType>test:NavMid</baseType>",
  "  <is>nav child</is>",
  "  <properties>",
  '    <label override="true" type="type:Text">',
  "      <documentation>child label</documentation>",
  "    </label>",
  "  </properties>",
  "  <aggregations>",
  '    <demo type="test:NavTarget[]">',
  "      <composition>",
  '        <test:NavTarget myProp="3" inheritedProp="1">',
  "          <otherProp>6</otherProp>",
  "          <myAggr>",
  "            <composition>",
  '              <test:NavInner someProp="6" />',
  "            </composition>",
  "          </myAggr>",
  "        </test:NavTarget>",
  "      </composition>",
  "    </demo>",
  "  </aggregations>",
  "</block>",
].join("\n");

const NAV_SKIP_BML = [
  `<block ${NAV_NS}>`,
  "  <name>NavSkip</name>",
  "  <type>test:NavSkip</type>",
  "  <baseType>test:NavParent</baseType>",
  "  <is>skips mid</is>",
  "  <properties>",
  '    <label override="true" type="type:Text">',
  "      <documentation>skip label</documentation>",
  "    </label>",
  "  </properties>",
  "</block>",
].join("\n");

const UNQUALIFIED_BML = [
  '<block xmlns="http://blockml.org/bml"',
  ' xmlns:core="org.blockml.bml.core"',
  ' xmlns:test="com.blockml.test.nav">',
  "  <name>NavMe</name>",
  "  <type>test:NavMe</type>",
  "  <baseType>core:Block</baseType>",
  "  <language>",
  "    <English />",
  "  </language>",
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

function registerParsed(workspace: WorkspaceState, text: string, filePath: string): void {
  const parsed = parse(text, { filePath, continueOnError: true });
  expect(parsed.document, `parse failed for ${filePath}: ${parsed.diagnostics.map((d) => d.message).join("; ")}`).not.toBeNull();
  workspace.registry.register(parsed.document!);
}

function registerNavMemberTypes(workspace: WorkspaceState): string {
  registerParsed(workspace, NAV_PARENT_BML, "/nav/NavParent.bml");
  registerParsed(workspace, NAV_MID_BML, "/nav/NavMid.bml");
  registerParsed(workspace, NAV_TARGET_PARENT_BML, "/nav/NavTargetParent.bml");
  registerParsed(workspace, NAV_INNER_BML, "/nav/NavInner.bml");
  registerParsed(workspace, NAV_TARGET_BML, "/nav/NavTarget.bml");
  registerParsed(workspace, NAV_CHILD_BML, "/nav/NavChild.bml");
  registerParsed(workspace, NAV_SKIP_BML, "/nav/NavSkip.bml");
  return NAV_CHILD_BML;
}

function memberRange(workspace: WorkspaceState, typeFqn: string, name: string) {
  const member = workspace.registry.get(typeFqn)?.block.members.find((entry) => entry.name === name);
  expect(member?.source, `${typeFqn}.${name} source`).toBeTruthy();
  return bomLocationToRange(member!.source!);
}

function sameLocation(a: LspLocation, b: LspLocation): boolean {
  return (
    a.uri === b.uri &&
    a.range.start.line === b.range.start.line &&
    a.range.start.character === b.range.start.character &&
    a.range.end.line === b.range.end.line &&
    a.range.end.character === b.range.end.character
  );
}

describe("definitionAt / referencesAt", () => {
  it("jumps from core:Block with originSelectionRange covering the whole QName", () => {
    const workspace = createWorkspace(ROOT);
    const expected = rangeOf(NAV_BML, "core:Block");
    const fromPrefix = definitionAt(NAV_BML, "nav.bml", positionAt(NAV_BML, "core:Block"), workspace);
    const fromLocal = definitionAt(NAV_BML, "nav.bml", positionAt(NAV_BML, "core:Block", 6), workspace);
    expect(fromPrefix).not.toBeNull();
    expect(fromLocal).not.toBeNull();
    expect(fromPrefix).toHaveLength(1);
    expect(fromPrefix![0]!.target.uri).toMatch(/core\/Block\.bml$/);
    expect(fromPrefix![0]!.originSelectionRange).toEqual(expected);
    expect(fromLocal![0]!.originSelectionRange).toEqual(expected);
    expect(fromLocal![0]!.target.uri).toBe(fromPrefix![0]!.target.uri);
    expect(
      fromPrefix![0]!.target.range.end.line > fromPrefix![0]!.target.range.start.line ||
        fromPrefix![0]!.target.range.end.character > fromPrefix![0]!.target.range.start.character,
    ).toBe(true);
  });

  it("jumps from type:Integer and not from the <count> tag", () => {
    const workspace = createWorkspace(ROOT);
    const fromTag = definitionAt(NAV_BML, "nav.bml", positionAt(NAV_BML, "<count "), workspace);
    expect(fromTag).toBeNull();
    const fromValue = definitionAt(NAV_BML, "nav.bml", positionAt(NAV_BML, "type:Integer"), workspace);
    expect(fromValue).not.toBeNull();
    expect(fromValue).toHaveLength(1);
    expect(fromValue![0]!.target.uri).toMatch(/type\/Integer\.bml$/);
    expect(fromValue![0]!.originSelectionRange).toEqual(rangeOf(NAV_BML, "type:Integer"));
  });

  it("jumps from unqualified Integer and English, not from language tags", () => {
    const workspace = createWorkspace(ROOT);
    expect(definitionAt(UNQUALIFIED_BML, "nav.bml", positionAt(UNQUALIFIED_BML, "<count "), workspace)).toBeNull();
    expect(definitionAt(UNQUALIFIED_BML, "nav.bml", positionAt(UNQUALIFIED_BML, "<type>"), workspace)).toBeNull();
    expect(definitionAt(UNQUALIFIED_BML, "nav.bml", positionAt(UNQUALIFIED_BML, "<language>"), workspace)).toBeNull();

    const fromType = definitionAt(UNQUALIFIED_BML, "nav.bml", positionAt(UNQUALIFIED_BML, "Integer"), workspace);
    expect(fromType).not.toBeNull();
    expect(fromType).toHaveLength(1);
    expect(fromType![0]!.target.uri).toMatch(/type\/Integer\.bml$/);
    expect(fromType![0]!.originSelectionRange).toEqual(rangeOf(UNQUALIFIED_BML, "Integer"));

    const fromLanguage = definitionAt(UNQUALIFIED_BML, "nav.bml", positionAt(UNQUALIFIED_BML, "English"), workspace);
    expect(fromLanguage).not.toBeNull();
    expect(fromLanguage).toHaveLength(1);
    expect(fromLanguage![0]!.target.uri).toMatch(/language\/English\.bml$/);
    expect(fromLanguage![0]!.originSelectionRange).toEqual(rangeOf(UNQUALIFIED_BML, "English"));
  });

  it("includes the core:Block declaration and a disk usage of baseType", () => {
    const workspace = createWorkspace(ROOT);
    const declaration = workspace.registry.get(CORE_BLOCK)?.block.source;
    expect(declaration?.file).toBeTruthy();

    let usageFile: string | undefined;
    let usageRange: LspLocation | undefined;
    for (const key of workspace.registry.keys()) {
      const block = workspace.registry.get(key)?.block;
      if (!block?.baseTypeSource?.file || block.baseType !== CORE_BLOCK) {
        continue;
      }
      const text = readFileSync(block.baseTypeSource.file, "utf8");
      if (!text.includes("core:Block")) {
        continue;
      }
      usageFile = block.baseTypeSource.file;
      usageRange = {
        uri: pathToFileURL(block.baseTypeSource.file).href,
        range: bomLocationToRange(block.baseTypeSource),
      };
      break;
    }
    expect(usageFile).toBeTruthy();
    expect(usageRange).toBeTruthy();

    const usageText = readFileSync(usageFile!, "utf8");
    const compact = usageText.includes("<baseType>core:Block");
    const refs = referencesAt(
      usageText,
      usageFile!,
      compact
        ? positionAt(usageText, "<baseType>core:Block", 11)
        : positionAt(usageText, "core:Block"),
      workspace,
    );
    expect(refs).not.toBeNull();

    const declarationUri = pathToFileURL(declaration!.file!).href;
    expect(refs!.some((loc) => loc.uri === declarationUri)).toBe(true);
    expect(refs!.some((loc) => sameLocation(loc, usageRange!))).toBe(true);
  });

  it("omits the defining block.source when includeDeclaration is false", () => {
    const workspace = createWorkspace(ROOT);
    const declaration = definitionAt(NAV_BML, "nav.bml", positionAt(NAV_BML, "core:Block"), workspace);
    expect(declaration).not.toBeNull();

    const withDecl = referencesAt(NAV_BML, "nav.bml", positionAt(NAV_BML, "core:Block"), workspace, true);
    const withoutDecl = referencesAt(NAV_BML, "nav.bml", positionAt(NAV_BML, "core:Block"), workspace, false);
    expect(withDecl).not.toBeNull();
    expect(withoutDecl).not.toBeNull();
    expect(withDecl!.some((loc) => sameLocation(loc, declaration![0]!.target))).toBe(true);
    expect(withoutDecl!.some((loc) => sameLocation(loc, declaration![0]!.target))).toBe(false);
    expect(withoutDecl!.length).toBeGreaterThan(0);
  });

  it("jumps from an override member tag to the nearest parent declaration", () => {
    const workspace = createWorkspace(ROOT);
    const child = registerNavMemberTypes(workspace);
    const fromTag = definitionAt(child, "/nav/NavChild.bml", positionAt(child, "<label override"), workspace);
    expect(fromTag).not.toBeNull();
    expect(fromTag).toHaveLength(1);
    expect(fromTag![0]!.originSelectionRange).toEqual(rangeOf(child, "label"));
    expect(fromTag![0]!.target.uri).toBe(pathToFileURL("/nav/NavMid.bml").href);
    expect(fromTag![0]!.target.range).toEqual(memberRange(workspace, "com.blockml.test.navmember.NavMid", "label"));
  });

  it("skips a silent parent and jumps to the grandparent override target", () => {
    const workspace = createWorkspace(ROOT);
    registerNavMemberTypes(workspace);
    const fromTag = definitionAt(NAV_SKIP_BML, "/nav/NavSkip.bml", positionAt(NAV_SKIP_BML, "<label override"), workspace);
    expect(fromTag).not.toBeNull();
    expect(fromTag![0]!.target.uri).toBe(pathToFileURL("/nav/NavParent.bml").href);
    expect(fromTag![0]!.target.range).toEqual(
      memberRange(workspace, "com.blockml.test.navmember.NavParent", "label"),
    );
  });

  it("does not jump from a member tag without override", () => {
    const workspace = createWorkspace(ROOT);
    registerNavMemberTypes(workspace);
    expect(definitionAt(NAV_PARENT_BML, "/nav/NavParent.bml", positionAt(NAV_PARENT_BML, "<label "), workspace)).toBeNull();
  });

  it("jumps from instance attribute names and opening member tags", () => {
    const workspace = createWorkspace(ROOT);
    const child = registerNavMemberTypes(workspace);
    const fromAttr = definitionAt(child, "/nav/NavChild.bml", positionAt(child, "myProp="), workspace);
    expect(fromAttr).not.toBeNull();
    expect(fromAttr![0]!.originSelectionRange).toEqual(rangeOf(child, "myProp"));
    expect(fromAttr![0]!.target.range).toEqual(
      memberRange(workspace, "com.blockml.test.navmember.NavTarget", "myProp"),
    );

    const fromChild = definitionAt(child, "/nav/NavChild.bml", positionAt(child, "<otherProp>"), workspace);
    expect(fromChild).not.toBeNull();
    expect(fromChild![0]!.originSelectionRange).toEqual(rangeOf(child, "otherProp"));
    expect(fromChild![0]!.target.range).toEqual(
      memberRange(workspace, "com.blockml.test.navmember.NavTarget", "otherProp"),
    );

    const fromAggr = definitionAt(child, "/nav/NavChild.bml", positionAt(child, "<myAggr>"), workspace);
    expect(fromAggr).not.toBeNull();
    expect(fromAggr![0]!.target.range).toEqual(
      memberRange(workspace, "com.blockml.test.navmember.NavTarget", "myAggr"),
    );

    const fromNested = definitionAt(child, "/nav/NavChild.bml", positionAt(child, "someProp="), workspace);
    expect(fromNested).not.toBeNull();
    expect(fromNested![0]!.target.range).toEqual(
      memberRange(workspace, "com.blockml.test.navmember.NavInner", "someProp"),
    );

    const fromInherited = definitionAt(child, "/nav/NavChild.bml", positionAt(child, "inheritedProp="), workspace);
    expect(fromInherited).not.toBeNull();
    expect(fromInherited![0]!.target.range).toEqual(
      memberRange(workspace, "com.blockml.test.navmember.NavTargetParent", "inheritedProp"),
    );
  });

  it("does not jump from instance attribute values or closing member tags", () => {
    const workspace = createWorkspace(ROOT);
    const child = registerNavMemberTypes(workspace);
    expect(definitionAt(child, "/nav/NavChild.bml", positionAt(child, 'myProp="3"', 8), workspace)).toBeNull();
    expect(definitionAt(child, "/nav/NavChild.bml", positionAt(child, "</otherProp>"), workspace)).toBeNull();
  });

  it("returns null outside the document and for invalid XML", () => {
    const workspace = createWorkspace(ROOT);
    const lines = NAV_BML.split("\n");
    const last = lines[lines.length - 1] ?? "";
    expect(
      definitionAt(
        NAV_BML,
        "nav.bml",
        { line: lines.length - 1, character: last.length },
        workspace,
      ),
    ).toBeNull();
    expect(referencesAt(NAV_BML, "nav.bml", { line: lines.length - 1, character: last.length }, workspace)).toBeNull();
    expect(definitionAt("<not-a-block>", "nav.bml", { line: 0, character: 0 }, workspace)).toBeNull();
    expect(referencesAt("<not-a-block>", "nav.bml", { line: 0, character: 0 }, workspace)).toBeNull();
  });
});
