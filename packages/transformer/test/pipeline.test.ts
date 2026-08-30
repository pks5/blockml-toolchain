import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Transformer } from "../src/runtime/transformer.js";
import { createDefaultPipeline } from "../src/pipeline/default-pipeline.js";
import type { ExecutionTrace, TransformPipeline } from "../src/pipeline/types.js";
import type { TransformationAgent } from "../src/agent/transformation-agent.js";
import type { ReflectionAgent } from "../src/agent/reflection-agent.js";
import {
  FIXED_NOW,
  pendingExecutionXml,
  pendingFqn,
  successfulAgent,
  writeProject,
} from "./fixture.js";

const TMP = join(import.meta.dirname, ".tmp-transformer-pipeline");

describe("Transformer pipeline", () => {
  beforeEach(() => {
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(TMP, { recursive: true });
  });

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it("runs prepare, execute, reflect, persist, finalize in order", async () => {
    writePending();
    const order: string[] = [];
    const transformer = new Transformer({
      workspaceRoot: TMP,
      pipeline: tracingPipeline(successfulAgent(), order),
      now: () => FIXED_NOW,
    });
    const result = await transformer.run(pendingFqn("JokeTest"));
    expect(result.success).toBe(true);
    expect(order).toEqual([
      "prepare",
      "execute",
      "reflect",
      "persist",
      "finalize",
    ]);
  });

  it("allows overlaying a single stage on the default pipeline", async () => {
    writePending();
    let reflected = false;
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: successfulAgent(),
      pipeline: {
        reflect: {
          async run(executed) {
            reflected = true;
            return {
              ...executed,
              changedFiles: ["model.bml"],
              feedback: "ok",
            };
          },
        },
      },
      now: () => FIXED_NOW,
    });
    await transformer.run(pendingFqn("JokeTest"));
    expect(reflected).toBe(true);
  });

  it("writes reflection into the running TaskExecution without relocating", async () => {
    writePending();
    const generated = "T00001_JokeTest_20260830T011702";
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: successfulAgent(),
      pipeline: {
        reflect: {
          async run(executed) {
            return {
              ...executed,
              changedFiles: ["model.bml"],
              feedback: "ok",
            };
          },
        },
        finalize: {
          async run() {
            return {
              success: true as const,
              pendingFqn: pendingFqn("JokeTest"),
              runningFqn: `com.example.model._transform.running.${generated}`,
              completedFqn: `com.example.model._transform.completed.${generated}`,
              sequence: 1,
              executionId: "fixture",
            };
          },
        },
      },
      now: () => FIXED_NOW,
    });
    await transformer.run(pendingFqn("JokeTest"));
    const runningPath = join(
      TMP,
      `blocks/com/example/model/_transform/running/${generated}.bml`,
    );
    expect(existsSync(runningPath)).toBe(true);
    expect(
      existsSync(
        join(TMP, `blocks/com/example/model/_transform/completed/${generated}.bml`),
      ),
    ).toBe(false);
    const running = readFileSync(runningPath, "utf8");
    expect(running).toContain("model.bml");
    expect(running).toContain(">ok</value>");
  });

  it("keeps persisted changedFiles and feedback after finalize", async () => {
    writePending();
    const generated = "T00001_JokeTest_20260830T011702";
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: successfulAgent(),
      pipeline: {
        reflect: {
          async run(executed) {
            return {
              ...executed,
              changedFiles: ["model.bml"],
              feedback: "ok",
            };
          },
        },
      },
      now: () => FIXED_NOW,
    });
    await transformer.run(pendingFqn("JokeTest"));
    const completed = readFileSync(
      join(TMP, `blocks/com/example/model/_transform/completed/${generated}.bml`),
      "utf8",
    );
    expect(completed).toContain("model.bml");
    expect(completed).toContain(">ok</value>");
    expect(completed).not.toContain(`_transform/running/${generated}`);
  });

  it("does not write changedFiles or feedback when reflection is empty", async () => {
    writePending();
    const generated = "T00001_JokeTest_20260830T011702";
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: successfulAgent(),
      now: () => FIXED_NOW,
    });
    await transformer.run(pendingFqn("JokeTest"));
    const completed = readFileSync(
      join(TMP, `blocks/com/example/model/_transform/completed/${generated}.bml`),
      "utf8",
    );
    expect(completed).not.toContain("<changedFiles");
    expect(completed).not.toContain("<feedback");
  });

  it("does not run reflect, persist, or finalize when execute fails", async () => {
    writePending();
    const order: string[] = [];
    const transformer = new Transformer({
      workspaceRoot: TMP,
      pipeline: tracingPipeline(
        {
          async execute() {
            return { success: false, exitCode: 1, error: "execute failed" };
          },
        },
        order,
      ),
      now: () => FIXED_NOW,
    });
    await expect(transformer.run(pendingFqn("JokeTest"))).rejects.toThrow(
      /execute failed/,
    );
    expect(order).toEqual(["prepare", "execute"]);
  });

  it("rejects construction without an agent or a complete pipeline", () => {
    expect(() => new Transformer({ workspaceRoot: TMP })).toThrow(
      /agent or a complete pipeline/,
    );
  });

  it("passes the execute trace to the reflect agent", async () => {
    writePending();
    let received: ExecutionTrace | undefined;
    const reflectAgent: ReflectionAgent = {
      async reflect(request) {
        received = request.trace;
        return { success: true, changedFiles: ["model.bml"], feedback: "ok" };
      },
    };
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: {
        async execute() {
          writeFileSync(join(TMP, "blocks/com/example/model/Extra.bml"), "<block/>\n");
          return { success: true, stdout: "wrote extra" };
        },
      },
      reflectAgent,
      now: () => FIXED_NOW,
    });
    await transformer.run(pendingFqn("JokeTest"));
    expect(received?.stdout).toBe("wrote extra");
    expect(received?.changedFiles).toEqual([]);
  });

  it("does not run persist or finalize when reflect fails", async () => {
    writePending();
    const order: string[] = [];
    const base = createDefaultPipeline(successfulAgent(), {
      async reflect() {
        return { success: false, exitCode: 1, error: "reflect failed" };
      },
    });
    const transformer = new Transformer({
      workspaceRoot: TMP,
      pipeline: {
        prepare: {
          async run(input, context) {
            order.push("prepare");
            return base.prepare.run(input, context);
          },
        },
        execute: {
          async run(input, context) {
            order.push("execute");
            return base.execute.run(input, context);
          },
        },
        reflect: {
          async run(input, context) {
            order.push("reflect");
            return base.reflect.run(input, context);
          },
        },
        persist: {
          async run(input, context) {
            order.push("persist");
            return base.persist.run(input, context);
          },
        },
        finalize: {
          async run(input, context) {
            order.push("finalize");
            return base.finalize.run(input, context);
          },
        },
      },
      now: () => FIXED_NOW,
    });
    await expect(transformer.run(pendingFqn("JokeTest"))).rejects.toThrow(/reflect failed/);
    expect(order).toEqual(["prepare", "execute", "reflect"]);
  });
});

function writePending(): void {
  writeProject(TMP, {
    "blocks/com/example/model/_transform/pending/JokeTest.bml": pendingExecutionXml({
      name: "JokeTest",
    }),
  });
}

function tracingPipeline(
  agent: TransformationAgent,
  order: string[],
): TransformPipeline {
  const base = createDefaultPipeline(agent);
  return {
    prepare: {
      async run(input, context) {
        order.push("prepare");
        return base.prepare.run(input, context);
      },
    },
    execute: {
      async run(input, context) {
        order.push("execute");
        return base.execute.run(input, context);
      },
    },
    reflect: {
      async run(input, context) {
        order.push("reflect");
        return base.reflect.run(input, context);
      },
    },
    persist: {
      async run(input, context) {
        order.push("persist");
        return base.persist.run(input, context);
      },
    },
    finalize: {
      async run(input, context) {
        order.push("finalize");
        return base.finalize.run(input, context);
      },
    },
  };
}
