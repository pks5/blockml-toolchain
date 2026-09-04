import { describe, expect, it } from "vitest";
import type { BlockDefinition, BlockInstance } from "@blockml/bom";
import {
  closeOperationTask,
  closeTaskInstance,
  emitClosedTaskSnippet,
} from "../src/execution/close-task.js";
import { buildBlockEvaluationScope } from "../src/execution/interpolate.js";
import { TransformError } from "../src/execution/errors.js";

const INSTRUCTION_TASK = "org.blockml.bml.transformer.workflow.InstructionTask";
const INSTRUCTION_RULE = "org.blockml.bml.transformer.workflow.InstructionRule";
const AGENTIC_OPERATION = "org.blockml.bml.transformer.workflow.AgenticOperation";

function blockWithParameters(fields: Record<string, string>): BlockDefinition {
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
          value: fields,
          typeFqn: "org.blockml.bml.type.Text",
        },
      },
    ],
  };
}

function instructionTask(raw: string, kind: "interpolated" | "expression" = "interpolated"): BlockInstance {
  return {
    typeFqn: INSTRUCTION_TASK,
    memberValues: {
      instructions:
        kind === "interpolated"
          ? { kind: "interpolated", raw, authoredPlacement: "element" }
          : { kind: "expression", raw, authoredPlacement: "element" },
    },
  };
}

function operationWithTask(task: BlockInstance): BlockInstance {
  return {
    typeFqn: AGENTIC_OPERATION,
    memberValues: {},
    aggregationCompositions: [
      {
        aggregationName: "task",
        composition: {
          aggregationName: "task",
          children: [{ kind: "blockInstance", instance: task }],
        },
      },
    ],
  };
}

describe("close-task", () => {
  it("closes every Task property against the transformation scope", () => {
    const scope = buildBlockEvaluationScope(
      blockWithParameters({ topic: "oak", lang: "German" }),
    );
    const closed = closeTaskInstance(
      {
        typeFqn: INSTRUCTION_TASK,
        memberValues: {
          instructions: {
            kind: "interpolated",
            raw: "Write about ${ #this.parameters.topic } in ${ #this.parameters.lang }",
            authoredPlacement: "element",
          },
          title: {
            kind: "literal",
            value: "Story ${ #this.parameters.topic }",
            typeFqn: "org.blockml.bml.type.Text",
          },
        },
      },
      scope,
    );
    expect(closed.memberValues.instructions).toEqual({
      kind: "literal",
      value: "Write about oak in German",
      typeFqn: "org.blockml.bml.type.Text",
      authoredPlacement: "element",
    });
    expect(closed.memberValues.title).toMatchObject({
      kind: "literal",
      value: "Story oak",
    });
  });

  it("closes nested Rule instructions", () => {
    const scope = buildBlockEvaluationScope(blockWithParameters({ mode: "strict" }));
    const closed = closeTaskInstance(
      {
        typeFqn: INSTRUCTION_TASK,
        memberValues: {
          instructions: {
            kind: "interpolated",
            raw: "Do the work",
            authoredPlacement: "element",
          },
        },
        aggregationCompositions: [
          {
            aggregationName: "rules",
            composition: {
              aggregationName: "rules",
              children: [
                {
                  kind: "blockInstance",
                  instance: {
                    typeFqn: INSTRUCTION_RULE,
                    memberValues: {
                      instructions: {
                        kind: "interpolated",
                        raw: "Stay ${ #this.parameters.mode }",
                        authoredPlacement: "element",
                      },
                    },
                  },
                },
              ],
            },
          },
        ],
      },
      scope,
    );
    const rule = closed.aggregationCompositions?.[0]?.composition.children[0];
    expect(rule?.kind).toBe("blockInstance");
    if (rule?.kind === "blockInstance") {
      expect(rule.instance.memberValues.instructions).toMatchObject({
        kind: "literal",
        value: "Stay strict",
      });
    }
  });

  it("closes a bare expression MemberValue", () => {
    const scope = buildBlockEvaluationScope(blockWithParameters({ topic: "pine" }));
    const closed = closeTaskInstance(
      instructionTask("#this.parameters.topic", "expression"),
      scope,
    );
    expect(closed.memberValues.instructions).toMatchObject({
      kind: "literal",
      value: "pine",
    });
  });

  it("throws when a path is unknown", () => {
    const transformation = blockWithParameters({ topic: "oak" });
    expect(() =>
      closeOperationTask(
        operationWithTask(instructionTask("Write about ${ #this.parameters.missing }")),
        transformation,
      ),
    ).toThrow(TransformError);
    try {
      closeOperationTask(
        operationWithTask(instructionTask("Write about ${ #this.parameters.missing }")),
        transformation,
      );
    } catch (error) {
      expect(error).toBeInstanceOf(TransformError);
      expect((error as TransformError).kind).toBe("execution");
      expect((error as Error).message).toMatch(/Unknown property/);
    }
  });

  it("throws when the operation has no task", () => {
    expect(() =>
      closeOperationTask(
        { typeFqn: AGENTIC_OPERATION, memberValues: {} },
        blockWithParameters({}),
      ),
    ).toThrow(/no configured task/);
  });

  it("emits FQN tags and manifested literals", () => {
    const snippet = closeOperationTask(
      operationWithTask(instructionTask("Write about ${ #this.parameters.topic }")),
      blockWithParameters({ topic: "oak" }),
    );
    expect(snippet).toContain(`<${INSTRUCTION_TASK}>`);
    expect(snippet).toContain("<instructions>Write about oak</instructions>");
    expect(snippet).not.toContain("${");
    expect(snippet).not.toContain("workflow:");
  });

  it("emits nested aggregations without a composition wrapper", () => {
    const scope = buildBlockEvaluationScope(blockWithParameters({ mode: "quiet" }));
    const closed = closeTaskInstance(
      {
        typeFqn: INSTRUCTION_TASK,
        memberValues: {},
        aggregationCompositions: [
          {
            aggregationName: "rules",
            composition: {
              aggregationName: "rules",
              children: [
                {
                  kind: "blockInstance",
                  instance: {
                    typeFqn: INSTRUCTION_RULE,
                    memberValues: {
                      instructions: {
                        kind: "literal",
                        value: "Be ${ #this.parameters.mode }",
                        typeFqn: "org.blockml.bml.type.Text",
                        authoredPlacement: "element",
                      },
                    },
                  },
                },
              ],
            },
          },
        ],
      },
      scope,
    );
    const snippet = emitClosedTaskSnippet([closed]);
    expect(snippet).toContain("<rules>");
    expect(snippet).toContain(`<${INSTRUCTION_RULE}>`);
    expect(snippet).toContain("<instructions>Be quiet</instructions>");
    expect(snippet).not.toContain("<composition>");
  });
});
