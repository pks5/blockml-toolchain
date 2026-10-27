import { describe, expect, it } from "vitest";
import { parse } from "../src/parse.js";

const BOOL = "org.blockml.bml.type.Boolean";
const TEXT = "org.blockml.bml.type.Text";
const INT = "org.blockml.bml.type.Integer";

function useXml(): string {
  return [
    '<test:Use xmlns="http://blockml.org/bml"',
    ' xmlns:core="org.blockml.bml.core"',
    ' xmlns:test="com.example">',
    "  <baseType>core:Block</baseType>",
    "  <is>use</is>",
    "  <aggregations>",
    "    <parts>",
    "      <composition>",
    '        <test:Brick pillars="true" label="true" count="2" />',
    "      </composition>",
    "    </parts>",
    "  </aggregations>",
    "</test:Use>",
  ].join("\n");
}

describe("instance member types", () => {
  it("parses attributes with the member type instead of the block FQN", () => {
    const parsed = parse(useXml(), {
      filePath: "Use.bml",
      parseValue: (typeFqn, raw) => {
        if (typeFqn === BOOL) {
          return { ok: true, value: raw === "true" };
        }
        if (typeFqn === INT) {
          return { ok: true, value: Number(raw) };
        }
        if (typeFqn === TEXT) {
          return { ok: true, value: raw };
        }
        return { ok: true, skipped: true };
      },
      resolveMemberType: (owner, name) => {
        if (owner !== "com.example.Brick") {
          return undefined;
        }
        if (name === "pillars") return BOOL;
        if (name === "label") return TEXT;
        if (name === "count") return INT;
        return undefined;
      },
    });
    const instance = parsed.document?.block.compositions[0]?.children[0];
    expect(instance?.kind).toBe("blockInstance");
    if (instance?.kind !== "blockInstance") {
      return;
    }
    expect(instance.instance.memberValues.pillars).toMatchObject({
      kind: "literal",
      value: true,
      typeFqn: BOOL,
    });
    expect(instance.instance.memberValues.label).toMatchObject({
      kind: "literal",
      value: "true",
      typeFqn: TEXT,
    });
    expect(instance.instance.memberValues.count).toMatchObject({
      kind: "literal",
      value: 2,
      typeFqn: INT,
    });
  });

  it("keeps the authored string when the member type is unresolved and parseValue skips", () => {
    const parsed = parse(useXml(), {
      filePath: "Use.bml",
      parseValue: () => ({ ok: true, skipped: true }),
    });
    const instance = parsed.document?.block.compositions[0]?.children[0];
    expect(instance?.kind).toBe("blockInstance");
    if (instance?.kind !== "blockInstance") {
      return;
    }
    expect(instance.instance.memberValues.pillars).toMatchObject({
      kind: "literal",
      value: "true",
      typeFqn: "com.example.Brick",
    });
  });
});
