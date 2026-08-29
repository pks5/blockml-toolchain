import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { bootstrapFullProjectRegistry } from "@blockml/framework";
import { TransformError } from "../src/execution/errors.js";
import { resolvePendingExecution } from "../src/execution/resolve.js";
import { TASK_EXECUTION_FQN } from "../src/execution/constants.js";
import {
  LIBRARY,
  pendingExecutionXml,
  pendingFqn,
  plainBlockXml,
  writeProject,
} from "./fixture.js";

const TMP = join(import.meta.dirname, ".tmp-transformer-resolve");

describe("resolvePendingExecution", () => {
  beforeEach(() => {
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(TMP, { recursive: true });
  });

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it("resolves a valid pending TaskExecution", () => {
    writeProject(TMP, {
      "blocks/com/example/model/_transform/pending/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
      }),
    });
    const resolved = resolvePendingExecution(pendingFqn("JokeTest"), TMP);
    expect(resolved.fqn).toBe(pendingFqn("JokeTest"));
    expect(resolved.libraryFqn).toBe(LIBRARY);
    expect(resolved.originalName).toBe("JokeTest");
    expect(resolved.document.block.baseType).toBe(TASK_EXECUTION_FQN);
  });

  it("rejects a non-TaskExecution FQN", () => {
    writeProject(TMP, {
      "blocks/com/example/model/Other.bml": plainBlockXml("Other"),
    });
    expect(() =>
      resolvePendingExecution(`${LIBRARY}.Other`, TMP),
    ).toThrow(TransformError);
    try {
      resolvePendingExecution(`${LIBRARY}.Other`, TMP);
    } catch (error) {
      expect(error).toBeInstanceOf(TransformError);
      expect((error as TransformError).kind).toBe("resolve");
      expect((error as TransformError).exitCode).toBe(2);
    }
  });

  it("rejects an execution outside _transform.pending", () => {
    writeProject(TMP, {
      "blocks/com/example/model/_transform/completed/OldOne.bml": pendingExecutionXml({
        name: "OldOne",
      }).replaceAll("pending", "completed"),
    });
    const { registry } = bootstrapFullProjectRegistry({ rootDir: TMP });
    expect(registry.get(`${LIBRARY}._transform.completed.OldOne`)).toBeTruthy();
    expect(() =>
      resolvePendingExecution(`${LIBRARY}._transform.completed.OldOne`, TMP),
    ).toThrow(/pending/);
  });
});
