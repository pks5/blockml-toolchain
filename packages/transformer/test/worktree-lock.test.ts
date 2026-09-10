import { existsSync, mkdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Transformer } from "../src/runtime/transformer.js";
import { TransformError } from "../src/execution/errors.js";
import {
  TRANSFORM_LOCK_STALE_MS,
  transformLockPath,
} from "../src/runtime/worktree-lock.js";
import {
  failingAgent,
  pendingExecutionXml,
  pendingFqn,
  successfulAgent,
  writeProject,
  fixtureTempDir,
} from "./fixture.js";
import type { TransformationAgent } from "../src/agent/transformation-agent.js";

const TMP = fixtureTempDir("worktree-lock");
const TMP_A = fixtureTempDir("worktree-lock-a");
const TMP_B = fixtureTempDir("worktree-lock-b");

describe("worktree transform lock", () => {
  beforeEach(() => {
    for (const dir of [TMP, TMP_A, TMP_B]) {
      rmSync(dir, { recursive: true, force: true });
      mkdirSync(dir, { recursive: true });
    }
  });

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
    rmSync(TMP_A, { recursive: true, force: true });
    rmSync(TMP_B, { recursive: true, force: true });
  });

  it("allows a single transformation to complete", async () => {
    writePending(TMP, "TaskA");
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: successfulAgent(),
    });
    const result = await transformer.run(pendingFqn("TaskA"));
    expect(result.success).toBe(true);
    expect(result.pendingFqn).toBe(pendingFqn("TaskA"));
  });

  it("rejects a second transform on the same worktree immediately", async () => {
    writePending(TMP, "TaskA");
    writePending(TMP, "TaskB");
    const gate = deferred();
    const firstStarted = deferred();
    const first = new Transformer({
      workspaceRoot: TMP,
      agent: hangingAgent(gate.promise, firstStarted.resolve),
    }).run(pendingFqn("TaskA"));
    await firstStarted.promise;

    const startedAt = Date.now();
    const second = new Transformer({
      workspaceRoot: TMP,
      agent: successfulAgent(),
    }).run(pendingFqn("TaskB"));
    await expect(second).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(TransformError);
      expect((error as TransformError).kind).toBe("busy");
      expect((error as TransformError).exitCode).toBe(2);
      expect((error as TransformError).message).toContain(
        "Transformation already running for this worktree.",
      );
      expect((error as TransformError).message).toContain(
        "Only one transformation may run at a time.",
      );
      expect((error as TransformError).message).toContain(pendingFqn("TaskA"));
      expect((error as TransformError).message).toContain(`PID: ${process.pid}`);
      return true;
    });
    expect(Date.now() - startedAt).toBeLessThan(1000);

    gate.resolve();
    await first;
  });

  it("allows another transform after a successful run", async () => {
    writePending(TMP, "TaskA");
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: successfulAgent(),
    });
    await transformer.run(pendingFqn("TaskA"));
    writePending(TMP, "TaskB");
    const second = await transformer.run(pendingFqn("TaskB"));
    expect(second.success).toBe(true);
    expect(second.pendingFqn).toBe(pendingFqn("TaskB"));
  }, 15_000);

  it("releases the lock when the agent fails", async () => {
    writePending(TMP, "TaskA");
    const failing = new Transformer({
      workspaceRoot: TMP,
      agent: failingAgent("agent failed"),
    });
    const result = await failing.run(pendingFqn("TaskA"));
    expect(result.success).toBe(false);
    expect(result.status).toBe("Failed");
    writePending(TMP, "TaskB");
    const next = await new Transformer({
      workspaceRoot: TMP,
      agent: successfulAgent(),
    }).run(pendingFqn("TaskB"));
    expect(next.success).toBe(true);
  }, 15_000);

  it("recovers a stale leftover lock and never steals a live lock", async () => {
    writePending(TMP, "TaskA");
    const sentinel = transformLockPath(TMP);
    mkdirSync(join(TMP, ".blockml"), { recursive: true });
    writeFileSync(sentinel, "");
    const lockDir = `${sentinel}.lock`;
    mkdirSync(lockDir);
    const staleAt = new Date(Date.now() - TRANSFORM_LOCK_STALE_MS * 2);
    utimesSync(lockDir, staleAt, staleAt);
    expect(existsSync(lockDir)).toBe(true);

    const recovered = await new Transformer({
      workspaceRoot: TMP,
      agent: successfulAgent(),
    }).run(pendingFqn("TaskA"));
    expect(recovered.success).toBe(true);
  });

  it("rejects a second transform from another package in the same worktree", async () => {
    const pkgA = join(TMP, "packages", "a");
    const pkgB = join(TMP, "packages", "b");
    writePending(pkgA, "TaskA", TMP);
    writePending(pkgB, "TaskB", TMP);
    expect(transformLockPath(pkgA)).toBe(transformLockPath(TMP));
    expect(transformLockPath(pkgB)).toBe(transformLockPath(TMP));

    const gate = deferred();
    const firstStarted = deferred();
    const first = new Transformer({
      workspaceRoot: pkgA,
      agent: hangingAgent(gate.promise, firstStarted.resolve),
    }).run(pendingFqn("TaskA"));
    await firstStarted.promise;

    const second = new Transformer({
      workspaceRoot: pkgB,
      agent: successfulAgent(),
    }).run(pendingFqn("TaskB"));
    await expect(second).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(TransformError);
      expect((error as TransformError).kind).toBe("busy");
      return true;
    });

    gate.resolve();
    await first;
  });

  it("allows concurrent transforms in different worktrees", async () => {
    writePending(TMP_A, "TaskA");
    writePending(TMP_B, "TaskB");
    const gateA = deferred();
    const gateB = deferred();
    const startedA = deferred();
    const startedB = deferred();
    const runA = new Transformer({
      workspaceRoot: TMP_A,
      agent: hangingAgent(gateA.promise, startedA.resolve),
    }).run(pendingFqn("TaskA"));
    const runB = new Transformer({
      workspaceRoot: TMP_B,
      agent: hangingAgent(gateB.promise, startedB.resolve),
    }).run(pendingFqn("TaskB"));

    await Promise.all([startedA.promise, startedB.promise]);
    gateA.resolve();
    gateB.resolve();
    const [resultA, resultB] = await Promise.all([runA, runB]);
    expect(resultA.success).toBe(true);
    expect(resultB.success).toBe(true);
  }, 15_000);
});

function writePending(dir: string, name: string, gitRoot = dir): void {
  writeProject(
    dir,
    {
      [`blocks/com/example/model/_meta/transform/pending/${name}.bml`]: pendingExecutionXml({
        name,
      }),
    },
    gitRoot,
  );
}

function hangingAgent(
  wait: Promise<void>,
  onStart: () => void,
): TransformationAgent {
  return {
    async execute() {
      onStart();
      await wait;
      return { success: true };
    },
  };
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
