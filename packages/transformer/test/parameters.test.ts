import { describe, expect, it } from "vitest";
import { TransformError } from "../src/execution/errors.js";
import {
  deepMergeParameters,
  parseParametersJson,
  rewriteParameterTypeFqns,
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

describe("rewriteParameterTypeFqns", () => {
  it("rewrites SubBlock instance typeFqns nested under a Stage", () => {
    const fromFqn = "pkg._meta.transform.pending.Poem";
    const toFqn = "pkg._meta.transform.running.T00001_Poem";
    const producerFqn = `${fromFqn}.TestResultProducer`;
    const block = {
      name: "Poem",
      type: toFqn,
      members: [
        {
          kind: "aggregation",
          name: "stages",
          composition: {
            aggregationName: "stages",
            children: [
              {
                kind: "blockInstance",
                instance: {
                  typeFqn: "org.blockml.bml.transformer.workflow.Stage",
                  memberValues: {},
                  aggregationCompositions: [
                    {
                      aggregationName: "resultProducer",
                      composition: {
                        aggregationName: "resultProducer",
                        children: [
                          {
                            kind: "blockInstance",
                            instance: {
                              typeFqn: producerFqn,
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
          name: "TestResultProducer",
          type: producerFqn,
          members: [],
        },
      ],
      compositions: [],
    } as unknown as import("@blockml/bom").BlockDefinition;

    rewriteParameterTypeFqns(block, fromFqn, toFqn);

    expect(block.subBlocks[0]?.type).toBe(`${toFqn}.TestResultProducer`);
    const stages = block.members[0] as {
      composition: { children: Array<{ instance: { aggregationCompositions: Array<{ composition: { children: Array<{ instance: { typeFqn: string } }> } }> } }> };
    };
    expect(
      stages.composition.children[0]?.instance.aggregationCompositions[0]
        ?.composition.children[0]?.instance.typeFqn,
    ).toBe(`${toFqn}.TestResultProducer`);
  });
});
