import { describe, expect, it } from "vitest";
import { parse } from "../src/parse.js";
import { serialize } from "@blockml/serializer";

function sample(body: string): string {
  return [
    '<block xmlns="http://blockml.org/bml"',
    ' xmlns:cap="org.blockml.bml.capability"',
    ' xmlns:core="org.blockml.bml.core"',
    ' xmlns:type="org.blockml.bml.type"',
    ' xmlns:workflow="org.blockml.bml.transformer.workflow"',
    ' xmlns:test="com.blockml.test.throws">',
    "  <name>Host</name>",
    "  <type>test:Host</type>",
    "  <baseType>core:Block</baseType>",
    "  <is>host</is>",
    "  <capabilities>",
    body,
    "  </capabilities>",
    "</block>",
  ].join("\n");
}

describe("capability throws mapping", () => {
  it("maps empty-QName sugar children and does not report unknown element", () => {
    const source = sample(
      [
        '    <satisfy type="cap:Action">',
        "      <throws>",
        "        <workflow:CriterionNotSatisfiedException />",
        "        <workflow:EvaluationException />",
        "      </throws>",
        "    </satisfy>",
      ].join("\n"),
    );
    const result = parse(source, { filePath: "throws-sugar.bml", continueOnError: true });
    expect(result.document).not.toBeNull();
    expect(result.diagnostics.some((d) => d.code === "BML_UNKNOWN_ELEMENT")).toBe(false);
    const satisfy = result.document!.block.members.find((m) => m.name === "satisfy");
    expect(satisfy?.kind).toBe("capability");
    if (satisfy?.kind !== "capability") {
      return;
    }
    expect(satisfy.throws).toHaveLength(2);
    expect(satisfy.throws![0]!.value).toBe(
      "org.blockml.bml.transformer.workflow.CriterionNotSatisfiedException",
    );
    expect(satisfy.throws![0]!.boundB).toBe("org.blockml.bml.core.Exception");
    expect(satisfy.throws![1]!.value).toBe(
      "org.blockml.bml.transformer.workflow.EvaluationException",
    );
  });

  it("maps explicit TypeReferenceEntity children", () => {
    const source = sample(
      [
        '    <satisfy type="cap:Action">',
        "      <throws>",
        '        <type:TypeReferenceEntity value="workflow:CriterionNotSatisfiedException" />',
        "      </throws>",
        "    </satisfy>",
      ].join("\n"),
    );
    const result = parse(source, { filePath: "throws-explicit.bml", continueOnError: true });
    expect(result.document).not.toBeNull();
    expect(result.diagnostics.some((d) => d.code === "BML_UNKNOWN_ELEMENT")).toBe(false);
    const satisfy = result.document!.block.members.find((m) => m.name === "satisfy");
    expect(satisfy?.kind).toBe("capability");
    if (satisfy?.kind !== "capability") {
      return;
    }
    expect(satisfy.throws).toHaveLength(1);
    expect(satisfy.throws![0]!.value).toBe(
      "org.blockml.bml.transformer.workflow.CriterionNotSatisfiedException",
    );
  });

  it("roundtrips throws sugar", () => {
    const source = sample(
      [
        '    <satisfy type="cap:Action">',
        "      <throws>",
        "        <workflow:CriterionNotSatisfiedException />",
        "      </throws>",
        "    </satisfy>",
      ].join("\n"),
    );
    const parsed = parse(source, { filePath: "throws-roundtrip.bml", continueOnError: true });
    expect(parsed.document).not.toBeNull();
    const serialized = serialize(parsed.document!);
    expect(serialized.text).toContain("<throws>");
    expect(serialized.text).toContain("workflow:CriterionNotSatisfiedException");
  });
});
