import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  acquireGraphLock,
  delay,
  isLadybugLockError,
  withLadybugLockRetry,
} from "../src/graph-lock.js";

const TMP = join(import.meta.dirname, ".tmp-graph-lock");

describe("graph lock helpers", () => {
  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it("detects Ladybug lock errors", () => {
    expect(
      isLadybugLockError(
        new Error("Could not set lock on file : /tmp/lbug (Error: Resource temporarily unavailable)"),
      ),
    ).toBe(true);
    expect(isLadybugLockError(new Error("Parser exception"))).toBe(false);
  });

  it("retries Ladybug lock errors then succeeds", async () => {
    let attempts = 0;
    const value = await withLadybugLockRetry(async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new Error("Could not set lock on file : /tmp/lbug");
      }
      return "ok";
    });
    expect(value).toBe("ok");
    expect(attempts).toBe(3);
  });

  it("serializes exclusive index locks", async () => {
    mkdirSync(TMP, { recursive: true });
    let concurrent = 0;
    let maxConcurrent = 0;
    async function hold(): Promise<void> {
      const release = await acquireGraphLock(TMP);
      concurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await delay(40);
      concurrent -= 1;
      await release();
    }
    await Promise.all([hold(), hold(), hold()]);
    expect(maxConcurrent).toBe(1);
  });
});
