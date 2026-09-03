import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Transformer } from "../src/runtime/transformer.js";
import { createDefaultPipeline } from "../src/pipeline/default-pipeline.js";
import type { ExecutionTrace, TransformPipeline } from "../src/pipeline/types.js";
import type { TransformationAgent } from "../src/agent/transformation-agent.js";
import type { ReflectionAgent } from "../src/agent/reflection-agent.js";
import { TOOL_OPERATION_FQN } from "../src/execution/constants.js";
import { ExecutorRegistry } from "../src/executor/registry.js";
import { ToolExecutor } from "../src/executor/tool-executor.js";
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
              output: "ok",
              outcome: "succeeded" as const,
            };
          },
        },
      },
      now: () => FIXED_NOW,
    });
    await transformer.run(pendingFqn("JokeTest"));
    expect(reflected).toBe(true);
  });

  it("writes reflection into the running ModelTransformation without relocating", async () => {
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
              output: "ok",
              outcome: "succeeded" as const,
            };
          },
        },
        finalize: {
          async run() {
            return {
              success: true as const,
              pendingFqn: pendingFqn("JokeTest"),
              runningFqn: `com.example.model._meta.transform.running.${generated}`,
              terminalFqn: `com.example.model._meta.transform.succeeded.${generated}`,
              status: "Succeeded" as const,
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
      `blocks/com/example/model/_meta/transform/running/${generated}.bml`,
    );
    expect(existsSync(runningPath)).toBe(true);
    expect(
      existsSync(
        join(TMP, `blocks/com/example/model/_meta/transform/succeeded/${generated}.bml`),
      ),
    ).toBe(false);
    const running = readFileSync(runningPath, "utf8");
    expect(running).toContain(
      '<type:FilePathEntity value="model.bml" />',
    );
    expect(running).toContain(">ok</output>");
  });

  it("keeps persisted changedFiles and output after finalize", async () => {
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
              output: "ok",
              outcome: "succeeded" as const,
            };
          },
        },
      },
      now: () => FIXED_NOW,
    });
    await transformer.run(pendingFqn("JokeTest"));
    const succeeded = readFileSync(
      join(TMP, `blocks/com/example/model/_meta/transform/succeeded/${generated}.bml`),
      "utf8",
    );
    expect(succeeded).toContain(
      '<type:FilePathEntity value="model.bml" />',
    );
    expect(succeeded).toContain(">ok</output>");
    expect(succeeded).not.toContain(`_meta/transform/running/${generated}`);
  });

  it("does not write changedFiles or output when captureOutput is false", async () => {
    writePending();
    const generated = "T00001_JokeTest_20260830T011702";
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: successfulAgent(),
      now: () => FIXED_NOW,
    });
    await transformer.run(pendingFqn("JokeTest"));
    const succeeded = readFileSync(
      join(TMP, `blocks/com/example/model/_meta/transform/succeeded/${generated}.bml`),
      "utf8",
    );
    expect(succeeded).not.toContain("<changedFiles");
    expect(succeeded).not.toContain("<output");
  });

  it("writes Execute stdout onto ModelOperation.output when captureOutput is true", async () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
        captureOutput: true,
      }),
    });
    const generated = "T00001_JokeTest_20260830T011702";
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: {
        async execute() {
          return { success: true, stdout: "agent said hello" };
        },
      },
      now: () => FIXED_NOW,
    });
    await transformer.run(pendingFqn("JokeTest"));
    const succeeded = readFileSync(
      join(TMP, `blocks/com/example/model/_meta/transform/succeeded/${generated}.bml`),
      "utf8",
    );
    expect(succeeded).toContain(">agent said hello</output>");
  });

  it("writes ToolExecutor output onto ToolOperation.output when captureOutput is true", async () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
        captureOutput: true,
        tool: { command: "blockml", args: ["validate"] },
      }),
    });
    const generated = "T00001_JokeTest_20260830T011702";
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: successfulAgent(),
      executors: new ExecutorRegistry().register(
        TOOL_OPERATION_FQN,
        new ToolExecutor(async () => ({
          exitCode: 0,
          stdout: "Validation succeeded. Tested 1 blocks, 0 with errors.\n",
          stderr: "",
        })),
      ),
      now: () => FIXED_NOW,
    });
    const result = await transformer.run(pendingFqn("JokeTest"));
    expect(result.success).toBe(true);
    const succeeded = readFileSync(
      join(TMP, `blocks/com/example/model/_meta/transform/succeeded/${generated}.bml`),
      "utf8",
    );
    expect(succeeded).toContain("workflow:ToolOperation");
    expect(succeeded).toContain(
      ">Validation succeeded. Tested 1 blocks, 0 with errors.</output>",
    );
  });

  it("skips reflect and still persists and finalizes when execute fails", async () => {
    writePending();
    const order: string[] = [];
    const generated = "T00001_JokeTest_20260830T011702";
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
    const result = await transformer.run(pendingFqn("JokeTest"));
    expect(result.success).toBe(false);
    expect(result.status).toBe("Failed");
    expect(result.error).toMatch(/execute failed/);
    expect(order).toEqual(["prepare", "execute", "persist", "finalize"]);
    const failedPath = join(
      TMP,
      `blocks/com/example/model/_meta/transform/failed/${generated}.bml`,
    );
    expect(existsSync(failedPath)).toBe(true);
    const failed = readFileSync(failedPath, "utf8");
    expect(failed).toContain("execute failed");
    expect(failed).toContain("<exception");
    expect(failed).toContain(">Failed</value>");
    expect(
      existsSync(
        join(TMP, `blocks/com/example/model/_meta/transform/running/${generated}.bml`),
      ),
    ).toBe(false);
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
        return { success: true, changedFiles: ["model.bml"], output: "ok" };
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
    expect(received?.changedFiles).toEqual([
      "blocks/com/example/model/Extra.bml",
    ]);
  });

  it("still persists and finalizes when reflect fails", async () => {
    writePending();
    const order: string[] = [];
    const generated = "T00001_JokeTest_20260830T011702";
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
    const result = await transformer.run(pendingFqn("JokeTest"));
    expect(result.success).toBe(false);
    expect(result.status).toBe("Failed");
    expect(order).toEqual(["prepare", "execute", "reflect", "persist", "finalize"]);
    expect(
      existsSync(
        join(TMP, `blocks/com/example/model/_meta/transform/failed/${generated}.bml`),
      ),
    ).toBe(true);
  });
});

function writePending(): void {
  writeProject(TMP, {
    "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": pendingExecutionXml({
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
