import { describe, expect, it } from "vitest";
import { TransformError } from "../src/execution/errors.js";
import {
  deepMergeParameters,
  parseParametersJson,
} from "../src/execution/parameters.js";

describe("parseParametersJson", () => {
  it("treats a missing flag as an empty object", () => {
    expect(parseParametersJson(undefined)).toEqual({});
  });

  it("parses a JSON object", () => {
    expect(parseParametersJson('{"language":"de"}')).toEqual({ language: "de" });
  });

  it("rejects invalid JSON", () => {
    expect(() => parseParametersJson("{")).toThrow(TransformError);
  });

  it("rejects a JSON array", () => {
    expect(() => parseParametersJson("[1]")).toThrow(/JSON object/);
  });
});

describe("deepMergeParameters", () => {
  it("lets CLI keys win and merges nested objects", () => {
    expect(
      deepMergeParameters(
        { topic: "tree", nested: { a: 1, b: 2 } },
        { language: "de", nested: { b: 3 } },
      ),
    ).toEqual({
      topic: "tree",
      language: "de",
      nested: { a: 1, b: 3 },
    });
  });

  it("replaces arrays instead of merging them", () => {
    expect(deepMergeParameters({ tags: ["a"] }, { tags: ["b", "c"] })).toEqual({
      tags: ["b", "c"],
    });
  });
});
