import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse } from "@blockml/parser";
import { Transformer } from "../src/runtime/transformer.js";
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
  EXECUTION_ID,
  FIXED_NOW,
  failingAgent,
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
      "blocks/com/example/model/_transform/pending/JokeTest.bml": pendingExecutionXml({
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

  it("increments from existing running and completed sequences", async () => {
    writeProject(TMP, {
      "blocks/com/example/model/_transform/completed/T00007_Prior_20260101T000000.bml":
        historyExecutionXml({
          name: "T00007_Prior_20260101T000000",
          stage: "completed",
          executionId: "aaaaaaaa-0000-4000-8000-000000000007",
          sequence: 7,
        }),
      "blocks/com/example/model/_transform/pending/JokeTest.bml": pendingExecutionXml({
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

  it("moves pending to running then completed, preserving executionId and references", async () => {
    writeProject(TMP, {
      "blocks/com/example/model/_transform/pending/JokeTest.bml": pendingExecutionXml({
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
    expect(result.executionId).toBe(EXECUTION_ID);
    expect(result.runningFqn).toBe(
      `com.example.model._transform.running.${generated}`,
    );
    expect(result.completedFqn).toBe(
      `com.example.model._transform.completed.${generated}`,
    );
    expect(calls).toEqual([result.runningFqn]);

    expect(
      existsSync(join(TMP, "blocks/com/example/model/_transform/pending/JokeTest.bml")),
    ).toBe(false);
    expect(
      existsSync(
        join(TMP, `blocks/com/example/model/_transform/running/${generated}.bml`),
      ),
    ).toBe(false);
    const completedPath = join(
      TMP,
      `blocks/com/example/model/_transform/completed/${generated}.bml`,
    );
    expect(existsSync(completedPath)).toBe(true);
    const completed = readFileSync(completedPath, "utf8");
    expect(completed).toContain(EXECUTION_ID);
    expect(completed).toContain("<value>1</value>");
    expect(completed).toContain(formatDateTimeProperty(FIXED_NOW));
    expect(completed).toContain("workflow:InstructionTask");

    const referrerPath = join(TMP, "blocks/com/example/model/Referrer.bml");
    const referrer = readFileSync(referrerPath, "utf8");
    expect(referrer).not.toContain("pending:JokeTest");
    const parsedReferrer = parse(referrer, { filePath: referrerPath });
    expect(parsedReferrer.document?.block.references?.[0]?.type).toBe(
      result.completedFqn,
    );
  });

  it("does not mark an execution completed when the agent fails", async () => {
    writeProject(TMP, {
      "blocks/com/example/model/_transform/pending/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
      }),
    });
    const generated = "T00001_JokeTest_20260830T011702";
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: failingAgent("claude exited 1"),
      now: () => FIXED_NOW,
    });
    await expect(transformer.run(pendingFqn("JokeTest"))).rejects.toThrow(/claude exited 1/);
    expect(
      existsSync(
        join(TMP, `blocks/com/example/model/_transform/running/${generated}.bml`),
      ),
    ).toBe(true);
    expect(
      existsSync(
        join(TMP, `blocks/com/example/model/_transform/completed/${generated}.bml`),
      ),
    ).toBe(false);
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
});
