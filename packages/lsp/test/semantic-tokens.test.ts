import { describe, expect, it } from "vitest";
import {
  SEMANTIC_TOKEN_SCOPES,
  SEMANTIC_TOKEN_TYPES,
  semanticHighlightSpans,
  semanticTokensFor,
  type HighlightSpan,
  type SemanticTokenType,
} from "../src/semantic-tokens.js";

const SAMPLE = [
  '<block xmlns="http://blockml.org/bml"',
  ' xmlns:core="org.blockml.bml.core"',
  ' xmlns:theme="org.blockml.bml.vscode.theme"',
  ' xmlns:type="org.blockml.bml.type">',
  "  <name>HoverMe</name>",
  "  <type>core:Block</type>",
  "  <abstract>true</abstract>",
  "  <documentation>docs</documentation>",
  "  <subBlocks>",
  "    <block>",
  "      <name>Inner</name>",
  "      <abstract>true</abstract>",
  "    </block>",
  "  </subBlocks>",
  "  <properties>",
  '    <count type="type:Integer">',
  "      <abstract>true</abstract>",
  "      <documentation>item count</documentation>",
  "      <composition>",
  '        <theme:HighlightRole bml:id="roleRoot">',
  "          <roleId>root</roleId>",
  "          <tags>",
  "            <composition>",
  '              <type:TextEntity value="block" />',
  "            </composition>",
  "          </tags>",
  "        </theme:HighlightRole>",
  "      </composition>",
  "    </count>",
  "  </properties>",
  "</block>",
].join("\n");

function nameSpan(text: string, openNeedle: string): HighlightSpan {
  const idx = text.indexOf(openNeedle);
  if (idx === -1) {
    throw new Error(`needle not found: ${openNeedle}`);
  }
  const nameStart = openNeedle.startsWith("</") ? idx + 2 : idx + 1;
  const spans = semanticHighlightSpans(text);
  const hit = spans.find((span) => span.startOffset <= nameStart && nameStart < span.endOffset);
  if (!hit) {
    throw new Error(`no span covering ${openNeedle}`);
  }
  return hit;
}

function typeAt(text: string, openNeedle: string): SemanticTokenType {
  return nameSpan(text, openNeedle).type;
}

describe("semanticHighlightSpans", () => {
  it("maps every token type to a *.bml TextMate scope", () => {
    expect(Object.keys(SEMANTIC_TOKEN_SCOPES).sort()).toEqual([...SEMANTIC_TOKEN_TYPES].sort());
    for (const type of SEMANTIC_TOKEN_TYPES) {
      expect(SEMANTIC_TOKEN_SCOPES[type].endsWith(".bml")).toBe(true);
    }
  });

  it("colors the block root and L1 declaration / facet / container by position", () => {
    expect(typeAt(SAMPLE, "<block xmlns")).toBe("root");
    expect(typeAt(SAMPLE, "<name>HoverMe")).toBe("blockDeclaration");
    expect(typeAt(SAMPLE, "<type>core:Block")).toBe("blockDeclaration");
    expect(typeAt(SAMPLE, "<abstract>true</abstract>\n  <documentation>")).toBe("blockDeclaration");
    expect(typeAt(SAMPLE, "<documentation>docs")).toBe("blockFacet");
    expect(typeAt(SAMPLE, "<subBlocks>")).toBe("blockContainer");
    expect(typeAt(SAMPLE, "<properties>")).toBe("memberContainer");
  });

  it("re-enters L1 inside a nested block and keeps inner abstract as declaration", () => {
    expect(typeAt(SAMPLE, "<block>\n      <name>Inner")).toBe("root");
    expect(typeAt(SAMPLE, "<name>Inner")).toBe("blockDeclaration");
    expect(typeAt(SAMPLE, "<abstract>true</abstract>\n    </block>")).toBe("blockDeclaration");
  });

  it("colors the same tag differently at member level", () => {
    expect(typeAt(SAMPLE, "<count type")).toBe("memberName");
    expect(typeAt(SAMPLE, "<abstract>true</abstract>\n      <documentation>item")).toBe("memberField");
    expect(typeAt(SAMPLE, "<documentation>item count")).toBe("memberFacet");
    expect(typeAt(SAMPLE, "<composition>\n        <theme:HighlightRole")).toBe("memberSubContainer");
  });

  it("does not treat title, description, or content as FrameworkRoles facets", () => {
    const src = [
      "<block>",
      "  <title>block title</title>",
      "  <description>block desc</description>",
      "  <content>block content</content>",
      "  <properties>",
      "    <title>member title</title>",
      "    <item>",
      "      <title>inner title</title>",
      "      <description>inner desc</description>",
      "      <content>inner content</content>",
      "    </item>",
      "  </properties>",
      "  <aggregations>",
      "    <description>agg desc</description>",
      "  </aggregations>",
      "</block>",
    ].join("\n");
    expect(typeAt(src, "<title>block title")).toBe("memberName");
    expect(typeAt(src, "<description>block desc")).toBe("memberName");
    expect(typeAt(src, "<content>block content")).toBe("memberName");
    expect(typeAt(src, "<title>member title")).toBe("memberName");
    expect(typeAt(src, "<description>agg desc")).toBe("memberName");
    expect(typeAt(src, "<title>inner title")).toBe("tag");
    expect(typeAt(src, "<description>inner desc")).toBe("tag");
    expect(typeAt(src, "<content>inner content")).toBe("tag");
  });

  it("colors PascalCase composition instances and nested composition children", () => {
    expect(typeAt(SAMPLE, "<theme:HighlightRole")).toBe("compositionInstance");
    expect(typeAt(SAMPLE, "</theme:HighlightRole>")).toBe("compositionInstance");
    expect(typeAt(SAMPLE, "<roleId>")).toBe("tag");
    expect(typeAt(SAMPLE, "<tags>")).toBe("tag");
    expect(typeAt(SAMPLE, "<composition>\n              <type:TextEntity")).toBe("memberSubContainer");
    expect(typeAt(SAMPLE, "<type:TextEntity")).toBe("compositionInstance");
  });

  it("keeps classification on a deeply nested stack (no TextMate depth limit)", () => {
    const depth = 24;
    const inner = "<properties><item><composition><theme:Role /></composition></item></properties>";
    let xml = inner;
    for (let n = 0; n < depth; n++) {
      xml = `<block><name>N${n}</name><subBlocks>${xml}</subBlocks></block>`;
    }
    expect(typeAt(xml, "<theme:Role")).toBe("compositionInstance");
    expect(typeAt(xml, "<name>N0")).toBe("blockDeclaration");
    expect(typeAt(xml, "<properties>")).toBe("memberContainer");
  });

  it("treats a type-as-root tag as root and keeps member nesting", () => {
    const src = [
      '<test:HoverMe xmlns="http://blockml.org/bml"',
      ' xmlns:core="org.blockml.bml.core"',
      ' xmlns:type="org.blockml.bml.type"',
      ' xmlns:test="com.blockml.test.hover">',
      "  <name>HoverMe</name>",
      "  <documentation>docs</documentation>",
      "  <properties>",
      '    <count type="type:Integer">',
      "      <documentation>item count</documentation>",
      "    </count>",
      "  </properties>",
      "</test:HoverMe>",
    ].join("\n");
    expect(typeAt(src, "<test:HoverMe")).toBe("root");
    expect(typeAt(src, "</test:HoverMe>")).toBe("root");
    expect(typeAt(src, "<name>HoverMe")).toBe("blockDeclaration");
    expect(typeAt(src, "<documentation>docs")).toBe("blockFacet");
    expect(typeAt(src, "<properties>")).toBe("memberContainer");
    expect(typeAt(src, "<count type")).toBe("memberName");
    expect(typeAt(src, "<documentation>item count")).toBe("memberFacet");
  });

  it("colors attributes, strings, comments, and interpolation", () => {
    const src = '<!-- note -->\n<block xmlns="http://blockml.org/bml" name="${x}" />';
    const spans = semanticHighlightSpans(src);
    const types = spans.map((s) => s.type);
    expect(types).toContain("blockComment");
    expect(types).toContain("commentPunctuation");
    expect(types).toContain("attribute");
    expect(types).toContain("stringDouble");
    expect(types).toContain("interpolation");
    expect(types).toContain("root");
  });
});

describe("semanticTokensFor", () => {
  it("encodes a non-empty LSP data array of 5-int groups", () => {
    const { data } = semanticTokensFor(SAMPLE);
    expect(data.length).toBeGreaterThan(0);
    expect(data.length % 5).toBe(0);
    expect(data.every((n) => Number.isInteger(n) && n >= 0)).toBe(true);
  });
});
