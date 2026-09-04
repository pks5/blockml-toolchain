import { describe, expect, it } from "vitest";
import type { BlockDefinition, BlockInstance } from "@blockml/bom";
import {
  buildBlockEvaluationScope,
  getOperationTaskInstructions,
  resolveMemberStringList,
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

  it("resolves InstructionTask instructions against the outer block", () => {
    const scope = buildBlockEvaluationScope(blockWithParameters("oak"));
    const operation: BlockInstance = {
      typeFqn: "org.blockml.bml.transformer.workflow.AgenticOperation",
      memberValues: {},
      aggregationCompositions: [
        {
          aggregationName: "task",
          composition: {
            aggregationName: "task",
            children: [
              {
                kind: "blockInstance",
                instance: {
                  typeFqn: "org.blockml.bml.transformer.workflow.InstructionTask",
                  memberValues: {
                    instructions: {
                      kind: "interpolated",
                      raw: "Write about ${ #this.parameters.mode }",
                    },
                  },
                },
              },
            ],
          },
        },
      ],
    };
    expect(getOperationTaskInstructions(operation, scope)).toBe("Write about oak");
  });
});
