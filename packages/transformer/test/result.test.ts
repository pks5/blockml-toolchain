import { describe, expect, it } from "vitest";
import {
  parseModelPath,
  readPath,
  ResultResolutionError,
} from "../src/execution/result.js";

describe("result mapping paths", () => {
  it("parses OpenUI5 model paths", () => {
    expect(parseModelPath(undefined, "sourcePath")).toEqual([]);
    expect(parseModelPath("/myProp", "sourcePath")).toEqual([
      { kind: "name", value: "myProp" },
    ]);
    expect(parseModelPath("/myProp/myChild", "sourcePath")).toEqual([
      { kind: "name", value: "myProp" },
      { kind: "name", value: "myChild" },
    ]);
    expect(parseModelPath("/1", "sourcePath")).toEqual([
      { kind: "index", value: 1 },
    ]);
    expect(parseModelPath("/3/myProp", "sourcePath")).toEqual([
      { kind: "index", value: 3 },
      { kind: "name", value: "myProp" },
    ]);
    expect(parseModelPath("/myProp/2", "sourcePath")).toEqual([
      { kind: "name", value: "myProp" },
      { kind: "index", value: 2 },
    ]);
  });

  it("rejects paths that do not start with /", () => {
    expect(() => parseModelPath("myProp", "sourcePath")).toThrow(
      ResultResolutionError,
    );
  });

  it("reads struct and array values", () => {
    expect(readPath({ myProp: "oak" }, [{ kind: "name", value: "myProp" }], "sourcePath")).toBe(
      "oak",
    );
    expect(readPath(["a", "b"], [{ kind: "index", value: 1 }], "sourcePath")).toBe("b");
    expect(
      readPath(
        [{ myProp: "oak" }],
        [
          { kind: "index", value: 0 },
          { kind: "name", value: "myProp" },
        ],
        "sourcePath",
      ),
    ).toBe("oak");
  });

  it("fails when a sourcePath field or index is missing", () => {
    expect(() =>
      readPath({ myProp: "oak" }, [{ kind: "name", value: "missing" }], "sourcePath"),
    ).toThrow(/field missing is missing/);
    expect(() =>
      readPath(["a"], [{ kind: "index", value: 1 }], "sourcePath"),
    ).toThrow(/index 1 is out of range/);
  });
});
