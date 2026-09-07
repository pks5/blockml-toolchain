import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { bootstrapFullProjectRegistry } from "@blockml/framework";
import { TransformError } from "../src/execution/errors.js";
import {
  allocateUniqueExecutionId,
  usedExecutionIds,
} from "../src/execution/execution-id.js";
import {
  historyExecutionXml,
  pendingExecutionXml,
  writeProject,
  fixtureTempDir,
} from "./fixture.js";

const TMP = fixtureTempDir("transformer-execution-id");
const USED_ID = "aaaaaaaa-0000-4000-8000-000000000007";
const FRESH_ID = "bbbbbbbb-0000-4000-8000-000000000008";

describe("allocateUniqueExecutionId", () => {
  beforeEach(() => {
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(TMP, { recursive: true });
  });

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it("returns a UUID that is not already used", () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/succeeded/T00007_Prior_20260101T000000.bml":
        historyExecutionXml({
          name: "T00007_Prior_20260101T000000",
          stage: "succeeded",
          executionId: USED_ID,
          sequence: 7,
        }),
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
      }),
    });
    const { registry } = bootstrapFullProjectRegistry({ rootDir: TMP });
    expect(usedExecutionIds(registry)).toEqual(new Set([USED_ID]));
    const id = allocateUniqueExecutionId(registry);
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(id).not.toBe(USED_ID);
  });

  it("retries when the generated id is already in use", () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/succeeded/T00007_Prior_20260101T000000.bml":
        historyExecutionXml({
          name: "T00007_Prior_20260101T000000",
          stage: "succeeded",
          executionId: USED_ID,
          sequence: 7,
        }),
    });
    const { registry } = bootstrapFullProjectRegistry({ rootDir: TMP });
    let calls = 0;
    const id = allocateUniqueExecutionId(registry, () => {
      calls += 1;
      return calls === 1 ? USED_ID : FRESH_ID;
    });
    expect(id).toBe(FRESH_ID);
    expect(calls).toBe(2);
  });

  it("throws when every generated id is already in use", () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/succeeded/T00007_Prior_20260101T000000.bml":
        historyExecutionXml({
          name: "T00007_Prior_20260101T000000",
          stage: "succeeded",
          executionId: USED_ID,
          sequence: 7,
        }),
    });
    const { registry } = bootstrapFullProjectRegistry({ rootDir: TMP });
    expect(() => allocateUniqueExecutionId(registry, () => USED_ID)).toThrow(
      TransformError,
    );
    try {
      allocateUniqueExecutionId(registry, () => USED_ID);
    } catch (error) {
      expect(error).toBeInstanceOf(TransformError);
      expect((error as TransformError).kind).toBe("execution");
      expect((error as TransformError).message).toMatch(/unique executionId/);
    }
  });
});
