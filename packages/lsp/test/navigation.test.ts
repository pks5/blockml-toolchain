import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { bomLocationToRange, createWorkspace, definitionAt, referencesAt } from "../src/index.js";
import type { LspLocation } from "../src/index.js";

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
  it("jumps from <baseType> to core/Block.bml", () => {
    const workspace = createWorkspace(ROOT);
    const locs = definitionAt(NAV_BML, "nav.bml", positionAt(NAV_BML, "<baseType>"), workspace);
    expect(locs).not.toBeNull();
    expect(locs).toHaveLength(1);
    expect(locs![0]!.uri).toMatch(/core\/Block\.bml$/);
    expect(locs![0]!.range.end.line > locs![0]!.range.start.line || locs![0]!.range.end.character > locs![0]!.range.start.character).toBe(
      true,
    );
  });

  it("jumps from a typed property to type/Integer.bml", () => {
    const workspace = createWorkspace(ROOT);
    const locs = definitionAt(NAV_BML, "nav.bml", positionAt(NAV_BML, "<count "), workspace);
    expect(locs).not.toBeNull();
    expect(locs).toHaveLength(1);
    expect(locs![0]!.uri).toMatch(/type\/Integer\.bml$/);
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
      positionAt(usageText, "<baseType>core:Block"),
      workspace,
    );
    expect(refs).not.toBeNull();

    const declarationUri = pathToFileURL(declaration!.file!).href;
    expect(refs!.some((loc) => loc.uri === declarationUri)).toBe(true);
    expect(refs!.some((loc) => sameLocation(loc, usageRange!))).toBe(true);
  });

  it("omits the defining block.source when includeDeclaration is false", () => {
    const workspace = createWorkspace(ROOT);
    const declaration = definitionAt(NAV_BML, "nav.bml", positionAt(NAV_BML, "<baseType>"), workspace);
    expect(declaration).not.toBeNull();

    const withDecl = referencesAt(NAV_BML, "nav.bml", positionAt(NAV_BML, "<baseType>"), workspace, true);
    const withoutDecl = referencesAt(NAV_BML, "nav.bml", positionAt(NAV_BML, "<baseType>"), workspace, false);
    expect(withDecl).not.toBeNull();
    expect(withoutDecl).not.toBeNull();
    expect(withDecl!.some((loc) => sameLocation(loc, declaration![0]!))).toBe(true);
    expect(withoutDecl!.some((loc) => sameLocation(loc, declaration![0]!))).toBe(false);
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
