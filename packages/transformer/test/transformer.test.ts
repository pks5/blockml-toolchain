import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse } from "@blockml/parser";
import { Transformer } from "../src/runtime/transformer.js";
import { TransformError } from "../src/execution/errors.js";
import { ClaudeCodeAgent } from "../src/agent/claude-code-agent.js";
import {
  formatDateTimeProperty,
  formatNameTimestamp,
  generateExecutionName,
  padSequence,
} from "../src/execution/lifecycle.js";
import { SequenceAllocator } from "../src/execution/sequence.js";
import { bootstrapFullProjectRegistry } from "@blockml/framework";
import {
  FIXED_NOW,
  failingAgent,
  gitHead,
  gitLogSubjects,
  gitParent,
  historyExecutionXml,
  pendingExecutionXml,
  pendingFqn,
  recordingAgent,
  referrerXml,
  successfulAgent,
  writeProject,
} from "./fixture.js";

const TMP = join(import.meta.dirname, ".tmp-transformer-run");

describe("execution naming", () => {
  it("zero-pads sequence to five digits", () => {
    expect(padSequence(1)).toBe("00001");
    expect(padSequence(12)).toBe("00012");
  });

  it("formats the name timestamp as yyyyMMdd'T'HHmmss", () => {
    expect(formatNameTimestamp(FIXED_NOW)).toBe("20260830T011702");
  });

  it("builds T{SEQ}_{OriginalName}_{timestamp}", () => {
    expect(generateExecutionName(1, "JokeTest", FIXED_NOW)).toBe(
      "T00001_JokeTest_20260830T011702",
    );
  });
});

describe("sequence allocation", () => {
  beforeEach(() => {
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(TMP, { recursive: true });
  });

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it("starts at 1 when no previous sequence exists", async () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
      }),
    });
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: successfulAgent(),
      now: () => FIXED_NOW,
    });
    const result = await transformer.run(pendingFqn("JokeTest"));
    expect(result.sequence).toBe(1);
  });

  it("increments from existing running and succeeded sequences", async () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/succeeded/T00007_Prior_20260101T000000.bml":
        historyExecutionXml({
          name: "T00007_Prior_20260101T000000",
          stage: "succeeded",
          executionId: "aaaaaaaa-0000-4000-8000-000000000007",
          sequence: 7,
        }),
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
      }),
    });
    const { registry } = bootstrapFullProjectRegistry({ rootDir: TMP });
    expect(new SequenceAllocator().nextSequence("com.example.model", registry)).toBe(8);
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: successfulAgent(),
      now: () => FIXED_NOW,
    });
    const result = await transformer.run(pendingFqn("JokeTest"));
    expect(result.sequence).toBe(8);
    expect(result.runningFqn).toContain("T00008_JokeTest_20260830T011702");
  });
});

describe("Transformer lifecycle", () => {
  beforeEach(() => {
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(TMP, { recursive: true });
  });

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it("moves pending to running then succeeded, assigning executionId and preserving references", async () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
      }),
      "blocks/com/example/model/Referrer.bml": referrerXml("Referrer", "pending:JokeTest"),
    });
    const generated = "T00001_JokeTest_20260830T011702";
    const calls: string[] = [];
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: recordingAgent(calls),
      now: () => FIXED_NOW,
    });
    const result = await transformer.run(pendingFqn("JokeTest"));

    expect(result.sequence).toBe(1);
    expect(result.executionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(result.runningFqn).toBe(
      `com.example.model._meta.transform.running.${generated}`,
    );
    expect(result.terminalFqn).toBe(
      `com.example.model._meta.transform.succeeded.${generated}`,
    );
    expect(result.status).toBe("Succeeded");
    expect(calls).toEqual([result.runningFqn]);

    expect(
      existsSync(join(TMP, "blocks/com/example/model/_meta/transform/pending/JokeTest.bml")),
    ).toBe(false);
    expect(
      existsSync(
        join(TMP, `blocks/com/example/model/_meta/transform/running/${generated}.bml`),
      ),
    ).toBe(false);
    const succeededPath = join(
      TMP,
      `blocks/com/example/model/_meta/transform/succeeded/${generated}.bml`,
    );
    expect(existsSync(succeededPath)).toBe(true);
    const succeeded = readFileSync(succeededPath, "utf8");
    expect(succeeded).toContain(result.executionId);
    expect(succeeded).toMatch(/<executionId[^>]*type="type:UUID"/);
    expect(succeeded).toContain("<value>1</value>");
    expect(succeeded).toContain(formatDateTimeProperty(FIXED_NOW));
    expect(succeeded).toContain("workflow:InstructionTask");
    expect(succeeded).toContain(">Succeeded</value>");
    expect(succeeded).not.toContain("<exception");

    const referrerPath = join(TMP, "blocks/com/example/model/Referrer.bml");
    const referrer = readFileSync(referrerPath, "utf8");
    expect(referrer).not.toContain("pending:JokeTest");
    const parsedReferrer = parse(referrer, { filePath: referrerPath });
    expect(parsedReferrer.document?.block.references?.[0]?.type).toBe(
      result.terminalFqn,
    );
  });

  it("copies a template pending ModelTransformation and leaves the original in place", async () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
        template: true,
      }),
      "blocks/com/example/model/Referrer.bml": referrerXml("Referrer", "pending:JokeTest"),
    });
    const generated = "T00001_JokeTest_20260830T011702";
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: successfulAgent(),
      now: () => FIXED_NOW,
    });
    const result = await transformer.run(pendingFqn("JokeTest"));

    expect(result.status).toBe("Succeeded");
    expect(result.terminalFqn).toBe(
      `com.example.model._meta.transform.succeeded.${generated}`,
    );

    const pendingPath = join(
      TMP,
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml",
    );
    expect(existsSync(pendingPath)).toBe(true);
    const pending = readFileSync(pendingPath, "utf8");
    expect(pending).toContain("<name>JokeTest</name>");
    expect(pending).toContain("<value>true</value>");
    expect(pending).not.toContain(result.executionId);
    expect(pending).not.toContain(generated);

    const succeededPath = join(
      TMP,
      `blocks/com/example/model/_meta/transform/succeeded/${generated}.bml`,
    );
    expect(existsSync(succeededPath)).toBe(true);
    const succeeded = readFileSync(succeededPath, "utf8");
    expect(succeeded).toContain(result.executionId);
    expect(succeeded).toContain(
      `<template override="true" type="type:Boolean">`,
    );
    expect(succeeded).toContain("<value>false</value>");
    expect(succeeded).not.toContain("<value>true</value>");

    const referrerPath = join(TMP, "blocks/com/example/model/Referrer.bml");
    const referrer = readFileSync(referrerPath, "utf8");
    expect(referrer).toContain("pending:JokeTest");
    const parsedReferrer = parse(referrer, { filePath: referrerPath });
    expect(parsedReferrer.document?.block.references?.[0]?.type).toBe(
      pendingFqn("JokeTest"),
    );
  });

  it("can apply a template pending ModelTransformation more than once", async () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
        template: true,
      }),
    });
    const first = new Transformer({
      workspaceRoot: TMP,
      agent: successfulAgent(),
      now: () => FIXED_NOW,
    });
    const firstResult = await first.run(pendingFqn("JokeTest"));
    expect(firstResult.status).toBe("Succeeded");

    const secondNow = new Date(2026, 7, 30, 1, 18, 2);
    const second = new Transformer({
      workspaceRoot: TMP,
      agent: successfulAgent(),
      now: () => secondNow,
    });
    const secondResult = await second.run(pendingFqn("JokeTest"));
    expect(secondResult.status).toBe("Succeeded");
    expect(secondResult.sequence).toBe(2);
    expect(secondResult.terminalFqn).toBe(
      "com.example.model._meta.transform.succeeded.T00002_JokeTest_20260830T011802",
    );
    expect(
      existsSync(
        join(TMP, "blocks/com/example/model/_meta/transform/pending/JokeTest.bml"),
      ),
    ).toBe(true);
    expect(
      existsSync(
        join(
          TMP,
          "blocks/com/example/model/_meta/transform/succeeded/T00001_JokeTest_20260830T011702.bml",
        ),
      ),
    ).toBe(true);
    expect(
      existsSync(
        join(
          TMP,
          "blocks/com/example/model/_meta/transform/succeeded/T00002_JokeTest_20260830T011802.bml",
        ),
      ),
    ).toBe(true);
  });

  it("writes empty parameters for the default EmptyStruct binding", async () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
      }),
    });
    const generated = "T00001_JokeTest_20260830T011702";
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: successfulAgent(),
      now: () => FIXED_NOW,
    });
    const result = await transformer.run(pendingFqn("JokeTest"));
    expect(result.status).toBe("Succeeded");
    const succeeded = readFileSync(
      join(TMP, `blocks/com/example/model/_meta/transform/succeeded/${generated}.bml`),
      "utf8",
    );
    expect(succeeded).toContain("EmptyStruct");
    expect(succeeded).toMatch(/<parameters[\s\S]*<value>\{\}<\/value>/);
  });

  it("rejects CLI parameters when T is EmptyStruct", async () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
      }),
    });
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: successfulAgent(),
      now: () => FIXED_NOW,
      parameters: { language: "de" },
    });
    await expect(transformer.run(pendingFqn("JokeTest"))).rejects.toSatisfy(
      (error: unknown) => {
        expect(error).toBeInstanceOf(TransformError);
        expect((error as TransformError).kind).toBe("resolve");
        expect((error as TransformError).message).toMatch(/Unknown parameter language/);
        return true;
      },
    );
    expect(
      existsSync(join(TMP, "blocks/com/example/model/_meta/transform/pending/JokeTest.bml")),
    ).toBe(true);
  });

  it("deep-merges CLI parameters over pending defaults for a bound T", async () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
        parameterFields: ["language", "topic"],
        pendingParameters: '{"topic":"tree"}',
      }),
    });
    const generated = "T00001_JokeTest_20260830T011702";
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: successfulAgent(),
      now: () => FIXED_NOW,
      parameters: { language: "de" },
    });
    const result = await transformer.run(pendingFqn("JokeTest"));
    expect(result.status).toBe("Succeeded");
    const succeeded = readFileSync(
      join(TMP, `blocks/com/example/model/_meta/transform/succeeded/${generated}.bml`),
      "utf8",
    );
    expect(succeeded).toContain("language");
    expect(succeeded).toContain("de");
    expect(succeeded).toContain("topic");
    expect(succeeded).toContain("tree");
    expect(succeeded).toContain(`${generated}.Parameters`);
    expect(succeeded).not.toContain("_meta.transform.running.");
    expect(succeeded).not.toContain("_meta.transform.pending.");
  });

  it("copies the parameter schema onto a template execution", async () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
        template: true,
        parameterFields: ["language"],
        pendingParameters: '{"language":"en"}',
      }),
    });
    const generated = "T00001_JokeTest_20260830T011702";
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: successfulAgent(),
      now: () => FIXED_NOW,
      parameters: { language: "de" },
    });
    const result = await transformer.run(pendingFqn("JokeTest"));
    expect(result.status).toBe("Succeeded");
    expect(
      existsSync(join(TMP, "blocks/com/example/model/_meta/transform/pending/JokeTest.bml")),
    ).toBe(true);
    const pending = readFileSync(
      join(TMP, "blocks/com/example/model/_meta/transform/pending/JokeTest.bml"),
      "utf8",
    );
    expect(pending).toContain("<name>JokeTest</name>");
    expect(pending).toContain('{"language":"en"}');
    const succeeded = readFileSync(
      join(TMP, `blocks/com/example/model/_meta/transform/succeeded/${generated}.bml`),
      "utf8",
    );
    expect(succeeded).toContain("de");
    expect(succeeded).toMatch(/<name>\s*Parameters\s*<\/name>/);
    expect(succeeded).toContain(`${generated}.Parameters`);
    expect(succeeded).toContain("<value>false</value>");
    expect(succeeded).not.toContain("pending:JokeTest");
    expect(succeeded).not.toContain("_meta.transform.pending.");
  });

  it("relocates a failed agent execution to failed with an exception", async () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
      }),
    });
    const generated = "T00001_JokeTest_20260830T011702";
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: failingAgent("claude exited 1"),
      now: () => FIXED_NOW,
    });
    const result = await transformer.run(pendingFqn("JokeTest"));
    expect(result.success).toBe(false);
    expect(result.status).toBe("Failed");
    expect(result.error).toMatch(/claude exited 1/);
    expect(result.terminalFqn).toBe(
      `com.example.model._meta.transform.failed.${generated}`,
    );
    expect(
      existsSync(
        join(TMP, `blocks/com/example/model/_meta/transform/running/${generated}.bml`),
      ),
    ).toBe(false);
    const failedPath = join(
      TMP,
      `blocks/com/example/model/_meta/transform/failed/${generated}.bml`,
    );
    expect(existsSync(failedPath)).toBe(true);
    const failed = readFileSync(failedPath, "utf8");
    expect(failed).toContain(">Failed</value>");
    expect(failed).toContain("<exception");
    expect(failed).toContain("claude exited 1");
  });

  it("orchestrates pipeline stages rather than calling ClaudeCodeAgent", () => {
    const source = readFileSync(
      join(import.meta.dirname, "../src/runtime/transformer.ts"),
      "utf8",
    );
    expect(source).not.toContain("ClaudeCodeAgent");
    expect(source).toContain("this.pipeline.prepare.run");
    expect(source).toContain("this.pipeline.execute.run");
    expect(source).toContain("this.pipeline.reflect.run");
    expect(source).toContain("this.pipeline.persist.run");
    expect(source).toContain("this.pipeline.finalize.run");
    expect(ClaudeCodeAgent.name).toBe("ClaudeCodeAgent");
  });

  it("aborts when the worktree is dirty and does not start the execution", async () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
      }),
    });
    writeFileSync(join(TMP, "dirty.txt"), "uncommitted");
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: successfulAgent(),
      now: () => FIXED_NOW,
    });
    await expect(transformer.run(pendingFqn("JokeTest"))).rejects.toSatisfy(
      (error: unknown) => {
        expect(error).toBeInstanceOf(TransformError);
        expect((error as TransformError).kind).toBe("resolve");
        expect((error as TransformError).message).toMatch(/not clean/i);
        return true;
      },
    );
    expect(
      existsSync(join(TMP, "blocks/com/example/model/_meta/transform/pending/JokeTest.bml")),
    ).toBe(true);
  });

  it("records HEAD as baseCommit and commits start, execute, and terminal snapshots", async () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
      }),
    });
    const headBefore = gitHead(TMP);
    const generated = "T00001_JokeTest_20260830T011702";
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: {
        async execute() {
          writeFileSync(join(TMP, "blocks/com/example/model/Face.bml"), "<block/>\n");
          return { success: true };
        },
      },
      now: () => FIXED_NOW,
    });
    const result = await transformer.run(pendingFqn("JokeTest"));
    expect(result.success).toBe(true);
    const succeeded = readFileSync(
      join(TMP, `blocks/com/example/model/_meta/transform/succeeded/${generated}.bml`),
      "utf8",
    );
    expect(succeeded).toContain(`<value>${headBefore}</value>`);
    expect(gitLogSubjects(TMP)).toEqual([
      `transform(succeeded): ${generated}`,
      `transform(stage): ${generated} #1`,
      `transform(stage-start): ${generated} #1`,
      `transform(start): ${generated}`,
      "fixture",
    ]);
  });

  it("persists Stage Running and baseCommit before the agent runs", async () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
      }),
    });
    const generated = "T00001_JokeTest_20260830T011702";
    const runningPath = join(
      TMP,
      `blocks/com/example/model/_meta/transform/running/${generated}.bml`,
    );
    let observedHead: string | undefined;
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: {
        async execute() {
          observedHead = gitHead(TMP);
          const running = readFileSync(runningPath, "utf8");
          expect(running).toContain('status="Running"');
          const parent = gitParent(TMP);
          expect(running).toContain(`<baseCommit>${parent}</baseCommit>`);
          return { success: true };
        },
      },
      now: () => FIXED_NOW,
    });
    const result = await transformer.run(pendingFqn("JokeTest"));
    expect(result.success).toBe(true);
    expect(observedHead).toBeDefined();
  });

  it("runs every Stage in an isolated execute call and stops after a failure", async () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
        stageInstructions: ["First stage task.", "Second stage task."],
      }),
    });
    const generated = "T00001_JokeTest_20260830T011702";
    const calls: number[] = [];
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: {
        async execute(request) {
          calls.push(request.stageIndex);
          if (request.stageIndex === 0) {
            return { success: false, exitCode: 1, error: "stage one failed" };
          }
          return { success: true };
        },
      },
      now: () => FIXED_NOW,
    });
    const result = await transformer.run(pendingFqn("JokeTest"));
    expect(result.success).toBe(false);
    expect(calls).toEqual([0]);
    const failed = readFileSync(
      join(TMP, `blocks/com/example/model/_meta/transform/failed/${generated}.bml`),
      "utf8",
    );
    expect(failed).toContain("stage one failed");
    expect(failed).toContain('status="Failed"');
    expect(failed).toContain("Second stage task.");
    expect(gitLogSubjects(TMP)).toEqual([
      `transform(failed): ${generated}`,
      `transform(stage): ${generated} #1`,
      `transform(stage-start): ${generated} #1`,
      `transform(start): ${generated}`,
      "fixture",
    ]);
  });

  it("succeeds only when every Stage succeeds and emits lifecycle events", async () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
        stageInstructions: ["First stage task.", "Second stage task."],
      }),
    });
    const generated = "T00001_JokeTest_20260830T011702";
    const events: string[] = [];
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: {
        async execute(request) {
          events.push(`execute:${request.stageIndex}`);
          return { success: true };
        },
      },
      onLifecycle: (event) => {
        events.push(
          event.kind === "transformationStatus" || event.kind === "stageStatus"
            ? `${event.kind}:${event.status}`
            : event.kind,
        );
      },
      now: () => FIXED_NOW,
    });
    const result = await transformer.run(pendingFqn("JokeTest"));
    expect(result.success).toBe(true);
    expect(result.status).toBe("Succeeded");
    expect(events).toEqual([
      "transformationStatus:Running",
      "stageStatus:Running",
      "stageExecuteStart",
      "execute:0",
      "stageExecuteEnd",
      "stageReflectStart",
      "stageReflectEnd",
      "stageStatus:Succeeded",
      "stageStatus:Running",
      "stageExecuteStart",
      "execute:1",
      "stageExecuteEnd",
      "stageReflectStart",
      "stageReflectEnd",
      "stageStatus:Succeeded",
      "transformationStatus:Succeeded",
      "transformationComplete",
    ]);
    expect(gitLogSubjects(TMP)).toEqual([
      `transform(succeeded): ${generated}`,
      `transform(stage): ${generated} #2`,
      `transform(stage-start): ${generated} #2`,
      `transform(stage): ${generated} #1`,
      `transform(stage-start): ${generated} #1`,
      `transform(start): ${generated}`,
      "fixture",
    ]);
  });

  it("relocates a pending file outside _meta/transform into _meta/transform stages", async () => {
    writeProject(TMP, {
      "blocks/com/example/model/temp/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
      }),
    });
    const generated = "T00001_JokeTest_20260830T011702";
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: successfulAgent(),
      now: () => FIXED_NOW,
    });
    const result = await transformer.run(pendingFqn("JokeTest"));
    expect(result.status).toBe("Succeeded");
    expect(
      existsSync(join(TMP, "blocks/com/example/model/temp/JokeTest.bml")),
    ).toBe(false);
    expect(
      existsSync(join(TMP, `blocks/com/example/model/running/${generated}.bml`)),
    ).toBe(false);
    expect(
      existsSync(join(TMP, `blocks/com/example/model/succeeded/${generated}.bml`)),
    ).toBe(false);
    expect(
      existsSync(
        join(
          TMP,
          `blocks/com/example/model/_meta/transform/succeeded/${generated}.bml`,
        ),
      ),
    ).toBe(true);
  });
});
