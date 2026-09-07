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
  LIBRARY,
  failingAgent,
  fixtureLibraryXml,
  gitHead,
  gitLogSubjects,
  gitParent,
  historyExecutionXml,
  availableFqn,
  pendingExecutionXml,
  pendingFqn,
  recordingAgent,
  referrerXml,
  resultSourceBlockXml,
  successfulAgent,
  writeProject,
  fixtureTempDir,
} from "./fixture.js";

const TMP = fixtureTempDir("transformer-run");

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
    expect(result.duration).toMatch(/^PT(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d+)?S)$/);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("org.blockml.bml.transformer.workflow.InstructionTask");
    expect(calls[0]).toContain("Do the task.");
    expect(calls[0]).not.toContain("${");

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
    expect(succeeded).toMatch(/<duration[^>]*type="type:Duration"/);
    expect(succeeded).toContain(`<value>${result.duration}</value>`);
    expect(succeeded).not.toContain("<exception");
    expect(succeeded).not.toContain("<result");
    expect(succeeded).not.toContain("<resultException");

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
      "blocks/com/example/model/_meta/transform/available/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
        segment: "available",
        template: true,
      }),
      "blocks/com/example/model/Referrer.bml": referrerXml("Referrer", "available:JokeTest"),
    });
    const generated = "T00001_JokeTest_20260830T011702";
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: successfulAgent(),
      now: () => FIXED_NOW,
    });
    const result = await transformer.run(availableFqn("JokeTest"));

    expect(result.status).toBe("Succeeded");
    expect(result.terminalFqn).toBe(
      `com.example.model._meta.transform.succeeded.${generated}`,
    );

    const availablePath = join(
      TMP,
      "blocks/com/example/model/_meta/transform/available/JokeTest.bml",
    );
    expect(existsSync(availablePath)).toBe(true);
    const available = readFileSync(availablePath, "utf8");
    expect(available).toContain("<name>JokeTest</name>");
    expect(available).toContain("<value>true</value>");
    expect(available).not.toContain(result.executionId);
    expect(available).not.toContain(generated);

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
    expect(referrer).toContain("available:JokeTest");
    const parsedReferrer = parse(referrer, { filePath: referrerPath });
    expect(parsedReferrer.document?.block.references?.[0]?.type).toBe(
      availableFqn("JokeTest"),
    );
  });

  it("can apply a template pending ModelTransformation more than once", async () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/available/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
        segment: "available",
        template: true,
      }),
    });
    const first = new Transformer({
      workspaceRoot: TMP,
      agent: successfulAgent(),
      now: () => FIXED_NOW,
    });
    const firstResult = await first.run(availableFqn("JokeTest"));
    expect(firstResult.status).toBe("Succeeded");

    const secondNow = new Date(2026, 7, 30, 1, 18, 2);
    const second = new Transformer({
      workspaceRoot: TMP,
      agent: successfulAgent(),
      now: () => secondNow,
    });
    const secondResult = await second.run(availableFqn("JokeTest"));
    expect(secondResult.status).toBe("Succeeded");
    expect(secondResult.sequence).toBe(2);
    expect(secondResult.terminalFqn).toBe(
      "com.example.model._meta.transform.succeeded.T00002_JokeTest_20260830T011802",
    );
    expect(
      existsSync(
        join(TMP, "blocks/com/example/model/_meta/transform/available/JokeTest.bml"),
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
  }, 15_000);

  it("does not write a parameters value when T is default Text and none is provided", async () => {
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
    expect(succeeded).not.toMatch(/<parameters[\s\S]*<value>/);
  });

  it("rejects a CLI object when T is Text", async () => {
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
        expect((error as TransformError).message).toMatch(/not compatible|must be a string/);
        return true;
      },
    );
    expect(
      existsSync(join(TMP, "blocks/com/example/model/_meta/transform/pending/JokeTest.bml")),
    ).toBe(true);
  });

  it("replaces pending Text parameters with the CLI value", async () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
        pendingParameters: "pending text",
      }),
    });
    const generated = "T00001_JokeTest_20260830T011702";
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: successfulAgent(),
      now: () => FIXED_NOW,
      parameters: "from cli",
    });
    const result = await transformer.run(pendingFqn("JokeTest"));
    expect(result.status).toBe("Succeeded");
    const succeeded = readFileSync(
      join(TMP, `blocks/com/example/model/_meta/transform/succeeded/${generated}.bml`),
      "utf8",
    );
    expect(succeeded).toContain("from cli");
    expect(succeeded).not.toContain("pending text");
  });

  it("clears an empty pending parameters object", async () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
        parameterFields: ["topic"],
        pendingParameters: "{}",
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
    expect(succeeded).not.toMatch(/<parameters[\s\S]*<value>\{\}<\/value>/);
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
      "blocks/com/example/model/_meta/transform/available/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
        segment: "available",
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
    const result = await transformer.run(availableFqn("JokeTest"));
    expect(result.status).toBe("Succeeded");
    expect(
      existsSync(join(TMP, "blocks/com/example/model/_meta/transform/available/JokeTest.bml")),
    ).toBe(true);
    const available = readFileSync(
      join(TMP, "blocks/com/example/model/_meta/transform/available/JokeTest.bml"),
      "utf8",
    );
    expect(available).toContain("<name>JokeTest</name>");
    expect(available).toContain('{"language":"en"}');
    const succeeded = readFileSync(
      join(TMP, `blocks/com/example/model/_meta/transform/succeeded/${generated}.bml`),
      "utf8",
    );
    expect(succeeded).toContain("de");
    expect(succeeded).toMatch(/<name>\s*Parameters\s*<\/name>/);
    expect(succeeded).toContain(`${generated}.Parameters`);
    expect(succeeded).toContain("<value>false</value>");
    expect(succeeded).not.toContain("available:JokeTest");
    expect(succeeded).not.toContain("_meta.transform.available.");
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
      `transform(operation): ${generated} #1`,
      `transform(operation-start): ${generated} #1`,
      `transform(start): ${generated}`,
      "fixture",
    ]);
  });

  it("persists ModelOperation Running and baseCommit before the agent runs", async () => {
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

  it("runs every ModelOperation in an isolated execute call and stops after a failure", async () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
        operationInstructions: ["First operation task.", "Second operation task."],
      }),
    });
    const generated = "T00001_JokeTest_20260830T011702";
    const calls: number[] = [];
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: {
        async execute(request) {
          calls.push(request.taskSnippet.includes("First operation task.") ? 0 : 1);
          if (request.taskSnippet.includes("First operation task.")) {
            return { success: false, exitCode: 1, error: "operation one failed" };
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
    expect(failed).toContain("operation one failed");
    expect(failed).toContain('status="Failed"');
    expect(failed).toContain("Second operation task.");
    expect(gitLogSubjects(TMP)).toEqual([
      `transform(failed): ${generated}`,
      `transform(operation): ${generated} #1`,
      `transform(operation-start): ${generated} #1`,
      `transform(start): ${generated}`,
      "fixture",
    ]);
  });

  it("succeeds only when every ModelOperation succeeds and emits lifecycle events", async () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
        operationInstructions: ["First operation task.", "Second operation task."],
      }),
    });
    const generated = "T00001_JokeTest_20260830T011702";
    const events: string[] = [];
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: {
        async execute(request) {
          events.push(
            `execute:${request.taskSnippet.includes("First operation task.") ? 0 : 1}`,
          );
          return { success: true };
        },
      },
      onLifecycle: (event) => {
        events.push(
          event.kind === "transformationStatus" || event.kind === "operationStatus"
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
      "operationStatus:Running",
      "operationExecuteStart",
      "execute:0",
      "operationExecuteEnd",
      "operationReflectStart",
      "operationReflectEnd",
      "operationStatus:Succeeded",
      "operationStatus:Running",
      "operationExecuteStart",
      "execute:1",
      "operationExecuteEnd",
      "operationReflectStart",
      "operationReflectEnd",
      "operationStatus:Succeeded",
      "transformationStatus:Succeeded",
      "transformationComplete",
    ]);
    expect(gitLogSubjects(TMP)).toEqual([
      `transform(succeeded): ${generated}`,
      `transform(operation): ${generated} #2`,
      `transform(operation-start): ${generated} #2`,
      `transform(operation): ${generated} #1`,
      `transform(operation-start): ${generated} #1`,
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

  it("relocates a source FQN outside the target library into that library _meta", async () => {
    const xml = pendingExecutionXml({ name: "CreateJoke", template: true })
      .replaceAll(`${LIBRARY}._meta.transform.pending`, `${LIBRARY}.program`)
      .replaceAll("xmlns:pending=", "xmlns:program=")
      .replaceAll("<type>pending:", "<type>program:");
    writeProject(TMP, {
      "blocks/com/example/model/program/CreateJoke.bml": xml,
    });
    const generated = "T00001_CreateJoke_20260830T011702";
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: successfulAgent(),
      now: () => FIXED_NOW,
    });
    const result = await transformer.run(`${LIBRARY}.program.CreateJoke`);
    expect(result.status).toBe("Succeeded");
    expect(result.terminalFqn).toBe(
      `${LIBRARY}._meta.transform.succeeded.${generated}`,
    );
    expect(
      existsSync(join(TMP, "blocks/com/example/model/program/CreateJoke.bml")),
    ).toBe(true);
    expect(
      existsSync(
        join(
          TMP,
          `blocks/com/example/model/_meta/transform/succeeded/${generated}.bml`,
        ),
      ),
    ).toBe(true);
  });

  it("writes _meta under --library even when the source lives elsewhere", async () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml":
        pendingExecutionXml({ name: "JokeTest" }),
      "blocks/com/other/target/Library.bml": fixtureLibraryXml("com.other.target"),
    });
    const generated = "T00001_JokeTest_20260830T011702";
    const transformer = new Transformer({
      workspaceRoot: TMP,
      library: "blocks/com/other/target/Library.bml",
      agent: successfulAgent(),
      now: () => FIXED_NOW,
    });
    const result = await transformer.run(pendingFqn("JokeTest"));
    expect(result.status).toBe("Succeeded");
    expect(result.terminalFqn).toBe(
      `com.other.target._meta.transform.succeeded.${generated}`,
    );
    expect(
      existsSync(
        join(TMP, `blocks/com/other/target/_meta/transform/succeeded/${generated}.bml`),
      ),
    ).toBe(true);
  });

  it("closes a ResultMapping source expression before copying result", async () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
        parameterFields: ["targetBlock"],
        pendingParameters: '{"targetBlock":"com.example.model.Poem"}',
        resultMappings: [
          {
            source:
              "${ #strings.concat(#this.parameters.targetBlock, '.properties.title') }",
          },
        ],
      }),
      "blocks/com/example/model/Poem.bml": resultSourceBlockXml({
        name: "Poem",
        properties: [{ name: "title", type: "type:Text", value: "El roble" }],
      }),
    });
    const generated = "T00001_JokeTest_20260830T011702";
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: successfulAgent(),
      now: () => FIXED_NOW,
    });
    const result = await transformer.run(pendingFqn("JokeTest"));
    expect(result.success).toBe(true);
    const succeeded = readFileSync(
      join(TMP, `blocks/com/example/model/_meta/transform/succeeded/${generated}.bml`),
      "utf8",
    );
    expect(succeeded).toMatch(/<result[\s>][\s\S]*El roble/);
  });

  it("fails when a ResultMapping source expression cannot be closed", async () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
        resultMappings: [{ source: "${ #this.parameters.missing }" }],
      }),
    });
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: successfulAgent(),
      now: () => FIXED_NOW,
    });
    const result = await transformer.run(pendingFqn("JokeTest"));
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Unknown property/);
  });

  it("writes result from ResultMapping when the ModelOperation succeeded", async () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
        resultMappings: [{ source: "com.example.model.Poem.properties.title" }],
      }),
      "blocks/com/example/model/Poem.bml": resultSourceBlockXml({
        name: "Poem",
        properties: [{ name: "title", type: "type:Text", value: "El roble" }],
      }),
    });
    const generated = "T00001_JokeTest_20260830T011702";
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: successfulAgent(),
      now: () => FIXED_NOW,
    });
    const result = await transformer.run(pendingFqn("JokeTest"));
    expect(result.success).toBe(true);
    expect(result.status).toBe("Succeeded");
    const succeeded = readFileSync(
      join(TMP, `blocks/com/example/model/_meta/transform/succeeded/${generated}.bml`),
      "utf8",
    );
    expect(succeeded).toMatch(/<result[\s>][\s\S]*El roble/);
    expect(succeeded).not.toMatch(/<exception[\s>]/);
  });

  it("fails with ResultException when ResultMapping source block is missing", async () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
        resultMappings: [{ source: "com.example.model.Missing.properties.title" }],
      }),
    });
    const generated = "T00001_JokeTest_20260830T011702";
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: successfulAgent(),
      now: () => FIXED_NOW,
    });
    const result = await transformer.run(pendingFqn("JokeTest"));
    expect(result.success).toBe(false);
    expect(result.status).toBe("Failed");
    expect(result.error).toMatch(/source block .* was not found/);
    const failed = readFileSync(
      join(TMP, `blocks/com/example/model/_meta/transform/failed/${generated}.bml`),
      "utf8",
    );
    expect(failed).toMatch(/<exception[\s>]/);
    expect(failed).toContain("was not found");
    expect(failed).not.toContain("workflow:ExecutionException");
  });

  it("fails with ResultException when ResultMapping source property is missing", async () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
        resultMappings: [{ source: "com.example.model.Poem.properties.missing" }],
      }),
      "blocks/com/example/model/Poem.bml": resultSourceBlockXml({
        name: "Poem",
        properties: [{ name: "title", type: "type:Text", value: "El roble" }],
      }),
    });
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: successfulAgent(),
      now: () => FIXED_NOW,
    });
    const result = await transformer.run(pendingFqn("JokeTest"));
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/property missing was not found/);
    expect(result.terminalFqn).toContain("._meta.transform.failed.");
  });

  it("fails with ResultException when ResultMapping source type differs from R", async () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
        resultMappings: [{ source: "com.example.model.Poem.properties.count" }],
      }),
      "blocks/com/example/model/Poem.bml": resultSourceBlockXml({
        name: "Poem",
        properties: [{ name: "count", type: "type:Integer", value: "3" }],
      }),
    });
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: successfulAgent(),
      now: () => FIXED_NOW,
    });
    const result = await transformer.run(pendingFqn("JokeTest"));
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/does not match result type/);
  });

  it("fails when resultPath is used on a Text result", async () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
        resultMappings: [
          {
            source: "com.example.model.Poem.properties.title",
            resultPath: "/foo",
          },
        ],
      }),
      "blocks/com/example/model/Poem.bml": resultSourceBlockXml({
        name: "Poem",
        properties: [{ name: "title", type: "type:Text", value: "El roble" }],
      }),
    });
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: successfulAgent(),
      now: () => FIXED_NOW,
    });
    const result = await transformer.run(pendingFqn("JokeTest"));
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/resultPath is not valid/);
  });

  it("fails when sourcePath is used on a Text source", async () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
        resultMappings: [
          {
            source: "com.example.model.Poem.properties.title",
            sourcePath: "/foo",
          },
        ],
      }),
      "blocks/com/example/model/Poem.bml": resultSourceBlockXml({
        name: "Poem",
        properties: [{ name: "title", type: "type:Text", value: "El roble" }],
      }),
    });
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: successfulAgent(),
      now: () => FIXED_NOW,
    });
    const result = await transformer.run(pendingFqn("JokeTest"));
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/sourcePath is not valid/);
  });

  it("reads a Struct field through sourcePath", async () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
        resultMappings: [
          {
            source: "com.example.model.Poem.properties.meta",
            sourcePath: "/title",
          },
        ],
      }),
      "blocks/com/example/model/Poem.bml": resultSourceBlockXml({
        name: "Poem",
        structs: [{ name: "Meta", fields: [{ name: "title", type: "type:Text" }] }],
        properties: [
          {
            name: "meta",
            type: "test:Poem.Meta",
            value: '{"title":"El roble"}',
          },
        ],
      }),
    });
    const generated = "T00001_JokeTest_20260830T011702";
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: successfulAgent(),
      now: () => FIXED_NOW,
    });
    const result = await transformer.run(pendingFqn("JokeTest"));
    expect(result.success).toBe(true);
    const succeeded = readFileSync(
      join(TMP, `blocks/com/example/model/_meta/transform/succeeded/${generated}.bml`),
      "utf8",
    );
    expect(succeeded).toMatch(/<result[\s>][\s\S]*El roble/);
  });

  it("builds result successively from resultPath mappings", async () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
        resultType: "Result",
        resultFields: [
          { name: "title", type: "type:Text" },
          { name: "artist", type: "type:Text" },
        ],
        resultMappings: [
          {
            source: "com.example.model.Poem.properties.title",
            resultPath: "/title",
          },
          {
            source: "com.example.model.Poem.properties.artist",
            resultPath: "/artist",
          },
        ],
      }),
      "blocks/com/example/model/Poem.bml": resultSourceBlockXml({
        name: "Poem",
        properties: [
          { name: "title", type: "type:Text", value: "El roble" },
          { name: "artist", type: "type:Text", value: "Anon" },
        ],
      }),
    });
    const generated = "T00001_JokeTest_20260830T011702";
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: successfulAgent(),
      now: () => FIXED_NOW,
    });
    const result = await transformer.run(pendingFqn("JokeTest"));
    expect(result.success).toBe(true);
    const succeeded = readFileSync(
      join(TMP, `blocks/com/example/model/_meta/transform/succeeded/${generated}.bml`),
      "utf8",
    );
    expect(succeeded).toMatch(/<result[\s>][\s\S]*El roble/);
    expect(succeeded).toMatch(/<result[\s>][\s\S]*Anon/);
    expect(succeeded).toMatch(
      /<result[^>]*type="succeeded:T00001_JokeTest_20260830T011702.Result"/,
    );
    expect(succeeded).not.toContain("_meta.transform.running.");
  });

  it("appends to a Text[] result when resultPath index equals length", async () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
        resultType: "type:Text[]",
        resultMappings: [
          {
            source: "com.example.model.Poem.properties.title",
            resultPath: "/0",
          },
          {
            source: "com.example.model.Poem.properties.artist",
            resultPath: "/1",
          },
        ],
      }),
      "blocks/com/example/model/Poem.bml": resultSourceBlockXml({
        name: "Poem",
        properties: [
          { name: "title", type: "type:Text", value: "El roble" },
          { name: "artist", type: "type:Text", value: "Anon" },
        ],
      }),
    });
    const generated = "T00001_JokeTest_20260830T011702";
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: successfulAgent(),
      now: () => FIXED_NOW,
    });
    const result = await transformer.run(pendingFqn("JokeTest"));
    expect(result.success).toBe(true);
    const succeeded = readFileSync(
      join(TMP, `blocks/com/example/model/_meta/transform/succeeded/${generated}.bml`),
      "utf8",
    );
    expect(succeeded).toMatch(/<result[\s>][\s\S]*El roble/);
    expect(succeeded).toMatch(/<result[\s>][\s\S]*Anon/);
  });

  it("leaves ModelTransformation exception empty when a ModelOperation fails", async () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
        resultMappings: [{ source: "com.example.model.Missing.properties.title" }],
      }),
    });
    const generated = "T00001_JokeTest_20260830T011702";
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: failingAgent("operation failed"),
      now: () => FIXED_NOW,
    });
    const result = await transformer.run(pendingFqn("JokeTest"));
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/operation failed/);
    const failed = readFileSync(
      join(TMP, `blocks/com/example/model/_meta/transform/failed/${generated}.bml`),
      "utf8",
    );
    expect(failed).toContain("<exception");
    expect(failed).not.toContain("ParametersException");
    expect(failed).not.toContain("ResultException");
  });

  it("closes a parameterMappings source expression before copying parameters", async () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
        pendingParameters: "com.example.model.Poem",
        parameterMappings: [
          {
            source: "${ #strings.concat(#this.parameters, '.properties.title') }",
          },
        ],
      }),
      "blocks/com/example/model/Poem.bml": resultSourceBlockXml({
        name: "Poem",
        properties: [{ name: "title", type: "type:Text", value: "El roble" }],
      }),
    });
    const generated = "T00001_JokeTest_20260830T011702";
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: successfulAgent(),
      now: () => FIXED_NOW,
      parameters: "ignored",
    });
    const result = await transformer.run(pendingFqn("JokeTest"));
    expect(result.success).toBe(true);
    const succeeded = readFileSync(
      join(TMP, `blocks/com/example/model/_meta/transform/succeeded/${generated}.bml`),
      "utf8",
    );
    expect(succeeded).toMatch(/<parameters[\s\S]*El roble/);
    expect(succeeded).not.toContain("ignored");
  });

  it("copies parameters from parameterMappings and ignores CLI parameters", async () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
        parameterMappings: [
          { source: "com.example.model.Poem.properties.title" },
        ],
      }),
      "blocks/com/example/model/Poem.bml": resultSourceBlockXml({
        name: "Poem",
        properties: [{ name: "title", type: "type:Text", value: "El roble" }],
      }),
    });
    const generated = "T00001_JokeTest_20260830T011702";
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: successfulAgent(),
      now: () => FIXED_NOW,
      parameters: "ignored",
    });
    const result = await transformer.run(pendingFqn("JokeTest"));
    expect(result.success).toBe(true);
    const succeeded = readFileSync(
      join(TMP, `blocks/com/example/model/_meta/transform/succeeded/${generated}.bml`),
      "utf8",
    );
    expect(succeeded).toMatch(/<parameters[\s\S]*El roble/);
    expect(succeeded).not.toContain("ignored");
  });

  it("fails with ParametersException when parameterMappings source block is missing", async () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
        parameterMappings: [
          { source: "com.example.model.Missing.properties.title" },
        ],
      }),
    });
    const generated = "T00001_JokeTest_20260830T011702";
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: successfulAgent(),
      now: () => FIXED_NOW,
    });
    const result = await transformer.run(pendingFqn("JokeTest"));
    expect(result.success).toBe(false);
    expect(result.status).toBe("Failed");
    expect(result.error).toMatch(/source block .* was not found/);
    const failed = readFileSync(
      join(TMP, `blocks/com/example/model/_meta/transform/failed/${generated}.bml`),
      "utf8",
    );
    expect(failed).toMatch(/<exception[\s>]/);
    expect(failed).toContain("ParametersException");
    expect(failed).not.toContain("ExecutionException");
    expect(
      existsSync(join(TMP, `blocks/com/example/model/_meta/transform/running/${generated}.bml`)),
    ).toBe(false);
  });

  it("fails with ParametersException when parameterMappings source type differs from T", async () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
        parameterMappings: [
          { source: "com.example.model.Poem.properties.count" },
        ],
      }),
      "blocks/com/example/model/Poem.bml": resultSourceBlockXml({
        name: "Poem",
        properties: [{ name: "count", type: "type:Integer", value: "3" }],
      }),
    });
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: successfulAgent(),
      now: () => FIXED_NOW,
    });
    const result = await transformer.run(pendingFqn("JokeTest"));
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/does not match parameters type/);
  });

  it("writes a parameterPath mapping into bound T", async () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
        parameterFields: ["title"],
        parameterMappings: [
          {
            source: "com.example.model.Poem.properties.title",
            parameterPath: "/title",
          },
        ],
      }),
      "blocks/com/example/model/Poem.bml": resultSourceBlockXml({
        name: "Poem",
        properties: [{ name: "title", type: "type:Text", value: "El roble" }],
      }),
    });
    const generated = "T00001_JokeTest_20260830T011702";
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: successfulAgent(),
      now: () => FIXED_NOW,
    });
    const result = await transformer.run(pendingFqn("JokeTest"));
    expect(result.success).toBe(true);
    const succeeded = readFileSync(
      join(TMP, `blocks/com/example/model/_meta/transform/succeeded/${generated}.bml`),
      "utf8",
    );
    expect(succeeded).toMatch(/<parameters[\s\S]*El roble/);
    expect(succeeded).toContain("parameterMappings");
  });

  it("lets CLI parameterMappings replace pending mappings and ignore --parameters", async () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
        parameterMappings: [
          { source: "com.example.model.Poem.properties.title" },
        ],
      }),
      "blocks/com/example/model/Poem.bml": resultSourceBlockXml({
        name: "Poem",
        properties: [
          { name: "title", type: "type:Text", value: "El roble" },
          { name: "artist", type: "type:Text", value: "CLI wins" },
        ],
      }),
    });
    const generated = "T00001_JokeTest_20260830T011702";
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: successfulAgent(),
      now: () => FIXED_NOW,
      parameters: "ignored",
      parameterMappings: [
        { source: "com.example.model.Poem.properties.artist" },
      ],
    });
    const result = await transformer.run(pendingFqn("JokeTest"));
    expect(result.success).toBe(true);
    const succeeded = readFileSync(
      join(TMP, `blocks/com/example/model/_meta/transform/succeeded/${generated}.bml`),
      "utf8",
    );
    expect(succeeded).toMatch(/<parameters[\s\S]*CLI wins/);
    expect(succeeded).toContain("com.example.model.Poem.properties.artist");
    expect(succeeded).not.toContain("com.example.model.Poem.properties.title");
    expect(succeeded).not.toContain("ignored");
  });
});
