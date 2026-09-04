import { describe, expect, it } from "vitest";
import type { BlockDefinition } from "@blockml/bom";
import {
  buildBlockEvaluationScope,
  closeMemberValue,
  resolveMemberStringList,
  resolveMemberText,
} from "../src/execution/interpolate.js";

function blockWithParameters(mode: string): BlockDefinition {
  return {
    name: "T",
    type: "org.blockml.bml.transformer.workflow.ModelTransformation",
    members: [
      {
        kind: "property",
        name: "parameters",
        typeFqn: "org.blockml.bml.type.Text",
        value: {
          kind: "literal",
          value: { mode },
          typeFqn: "org.blockml.bml.type.Text",
        },
      },
    ],
  };
}

describe("transformer interpolation", () => {
  it("resolves ${} holes inside Text[] string leaves", () => {
    const scope = buildBlockEvaluationScope(blockWithParameters("validate"));
    const args = resolveMemberStringList(
      {
        kind: "literal",
        value: ["${ #this.parameters.mode }"],
        typeFqn: "org.blockml.bml.type.Text",
      },
      scope,
    );
    expect(args).toEqual(["validate"]);
  });

  it("resolves a bare expression MemberValue to text", () => {
    const scope = buildBlockEvaluationScope(blockWithParameters("oak"));
    expect(
      resolveMemberText({ kind: "expression", raw: "#this.parameters.mode" }, scope),
    ).toBe("oak");
  });

  it("closes interpolated text to a literal without leftover ${}", () => {
    const scope = buildBlockEvaluationScope(blockWithParameters("oak"));
    const closed = closeMemberValue(
      { kind: "interpolated", raw: "Write about ${ #this.parameters.mode }" },
      scope,
    );
    expect(closed).toMatchObject({
      kind: "literal",
      value: "Write about oak",
    });
    expect(String(closed.kind === "literal" ? closed.value : "")).not.toContain("${");
  });
});
