import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { bomLocationToRange, createWorkspace, definitionAt, referencesAt } from "../src/index.js";
import type { LspLocation } from "../src/index.js";
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
      if (!text.includes("<baseType>core:Block")) {
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
    const refs = referencesAt(
      usageText,
      usageFile!,
      positionAt(usageText, "<baseType>core:Block", 11),
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
