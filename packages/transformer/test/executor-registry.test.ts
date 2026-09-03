import { describe, expect, it } from "vitest";
import { TypeRegistry } from "@blockml/framework";
import { AGENTIC_OPERATION_FQN, MODEL_OPERATION_FQN } from "../src/execution/constants.js";
import { TransformError } from "../src/execution/errors.js";
import { ExecutorRegistry } from "../src/executor/registry.js";
import type { OperationExecutor } from "../src/executor/operation-executor.js";

function stubExecutor(): OperationExecutor {
  return {
    async execute() {
      return { success: true, output: "ok" };
    },
  };
}

function registryWith(types: Record<string, { type: string; baseType?: string }>): TypeRegistry {
  const registry = new TypeRegistry();
  for (const [fqn, block] of Object.entries(types)) {
    registry.register({
      kind: "block",
      source: { filePath: `${fqn}.bml`, format: "xml" },
      block: {
        name: fqn.split(".").at(-1) ?? fqn,
        type: block.type,
        baseType: block.baseType,
        members: [],
        subBlocks: [],
        embeddedBlocks: [],
        compositions: [],
      },
    });
  }
  return registry;
}

describe("ExecutorRegistry", () => {
  it("resolves the most specific registered executor on the base-type chain", () => {
    const types = registryWith({
      [MODEL_OPERATION_FQN]: { type: MODEL_OPERATION_FQN },
      [AGENTIC_OPERATION_FQN]: {
        type: AGENTIC_OPERATION_FQN,
        baseType: MODEL_OPERATION_FQN,
      },
    });
    const agentic = stubExecutor();
    const executors = new ExecutorRegistry().register(AGENTIC_OPERATION_FQN, agentic);
    expect(executors.resolve(AGENTIC_OPERATION_FQN, types)).toBe(agentic);
  });

  it("rejects the abstract ModelOperation type", () => {
    const types = registryWith({
      [MODEL_OPERATION_FQN]: { type: MODEL_OPERATION_FQN },
    });
    const executors = new ExecutorRegistry();
    expect(() => executors.resolve(MODEL_OPERATION_FQN, types)).toThrow(TransformError);
    expect(() => executors.resolve(MODEL_OPERATION_FQN, types)).toThrow(
      /abstract/,
    );
  });

  it("rejects an unknown operation type with no registered executor", () => {
    const other = "org.example.OtherOperation";
    const types = registryWith({
      [MODEL_OPERATION_FQN]: { type: MODEL_OPERATION_FQN },
      [other]: { type: other, baseType: MODEL_OPERATION_FQN },
    });
    const executors = new ExecutorRegistry();
    expect(() => executors.resolve(other, types)).toThrow(
      /No OperationExecutor registered/,
    );
  });
});
