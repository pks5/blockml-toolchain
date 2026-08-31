import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TransformError } from "../src/execution/errors.js";
import { executionFilePath } from "../src/execution/lifecycle.js";

const LIBRARY = "org.blockml.bml.workspace";

describe("executionFilePath", () => {
  it("places a pending file already under _meta/transform into the target stage", () => {
    expect(
      executionFilePath(
        "blocks/org/blockml/bml/workspace/_meta/transform/pending/PoemTest.bml",
        LIBRARY,
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

  it("places a file outside _meta/transform under the library _meta/transform stage", () => {
    expect(
      executionFilePath(
        "blocks/org/blockml/bml/workspace/temp/PoemTest.bml",
        LIBRARY,
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
        "/repo/blocks/org/blockml/bml/workspace/running/T00002_PoemTest_20260831T192003.bml",
        LIBRARY,
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

  it("throws when the path is not under the library", () => {
    expect(() =>
      executionFilePath(
        "blocks/com/example/other/PoemTest.bml",
        LIBRARY,
        "running",
        "T00002_PoemTest_20260831T192003",
      ),
    ).toThrow(TransformError);
  });
});
