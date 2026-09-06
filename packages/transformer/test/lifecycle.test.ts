import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { executionFilePath } from "../src/execution/lifecycle.js";

describe("executionFilePath", () => {
  it("places a stage file under dirname(Library.bml)/_meta/transform", () => {
    expect(
      executionFilePath(
        "blocks/org/blockml/bml/workspace",
        "running",
        "T00002_PoemTest_20260831T192003",
      ),
    ).toBe(
      join(
        "blocks/org/blockml/bml/workspace",
        "_meta",
        "transform",
        "running",
        "T00002_PoemTest_20260831T192003.bml",
      ),
    );
  });

  it("relocates running to succeeded under _meta/transform, not the library root", () => {
    expect(
      executionFilePath(
        "/repo/blocks/org/blockml/bml/workspace",
        "succeeded",
        "T00002_PoemTest_20260831T192003",
      ),
    ).toBe(
      join(
        "/repo/blocks/org/blockml/bml/workspace",
        "_meta",
        "transform",
        "succeeded",
        "T00002_PoemTest_20260831T192003.bml",
      ),
    );
  });
});
