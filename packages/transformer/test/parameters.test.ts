import { describe, expect, it } from "vitest";
import { TransformError } from "../src/execution/errors.js";
import {
  deepMergeParameters,
  parseParametersJson,
  rewriteParameterTypeFqns,
} from "../src/execution/parameters.js";

describe("parseParametersJson", () => {
  it("treats a missing flag as undefined", () => {
    expect(parseParametersJson(undefined)).toBeUndefined();
  });

  it("parses a JSON object", () => {
    expect(parseParametersJson('{"language":"de"}')).toEqual({ language: "de" });
  });

  it("parses a JSON string", () => {
    expect(parseParametersJson('"hello"')).toBe("hello");
  });

  it("parses a JSON array", () => {
    expect(parseParametersJson("[1]")).toEqual([1]);
  });

  it("rejects invalid JSON", () => {
    expect(() => parseParametersJson("{")).toThrow(TransformError);
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

describe("rewriteParameterTypeFqns", () => {
  it("rewrites SubBlock instance typeFqns nested under a ModelOperation", () => {
    const fromFqn = "pkg._meta.transform.pending.Poem";
    const toFqn = "pkg._meta.transform.running.T00001_Poem";
    const nestedFqn = `${fromFqn}.CustomTask`;
    const block = {
      name: "Poem",
      type: toFqn,
      members: [
        {
          kind: "aggregation",
          name: "operations",
          composition: {
            aggregationName: "operations",
            children: [
              {
                kind: "blockInstance",
                instance: {
                  typeFqn: "org.blockml.bml.transformer.workflow.ModelOperation",
                  memberValues: {},
                  aggregationCompositions: [
                    {
                      aggregationName: "task",
                      composition: {
                        aggregationName: "task",
                        children: [
                          {
                            kind: "blockInstance",
                            instance: {
                              typeFqn: nestedFqn,
                              memberValues: {},
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
      subBlocks: [
        {
          name: "CustomTask",
          type: nestedFqn,
          members: [],
        },
      ],
      compositions: [],
    } as unknown as import("@blockml/bom").BlockDefinition;

    rewriteParameterTypeFqns(block, fromFqn, toFqn);

    expect(block.subBlocks[0]?.type).toBe(`${toFqn}.CustomTask`);
    const operations = block.members[0] as {
      composition: { children: Array<{ instance: { aggregationCompositions: Array<{ composition: { children: Array<{ instance: { typeFqn: string } }> } }> } }> };
    };
    expect(
      operations.composition.children[0]?.instance.aggregationCompositions[0]
        ?.composition.children[0]?.instance.typeFqn,
    ).toBe(`${toFqn}.CustomTask`);
  });
});
