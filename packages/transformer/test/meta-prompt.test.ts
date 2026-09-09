import { mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { bootstrapFullProjectRegistry } from "@blockml/framework";
import type { BlockInstance } from "@blockml/bom";
import { Transformer } from "../src/runtime/transformer.js";
import {
  AGENTIC_OPERATION_FQN,
  TEXT_TYPE_FQN,
} from "../src/execution/constants.js";
import { getEffectiveOperationText } from "../src/execution/properties.js";
import {
  FIXED_NOW,
  pendingExecutionXml,
  pendingFqn,
  writeProject,
  fixtureTempDir,
} from "./fixture.js";

const WORKSPACE_ROOT = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const TMP = fixtureTempDir("meta-prompt");
const DEFAULT_META = "Execute Task.run on this closed instance:";

function operation(
  memberValues: BlockInstance["memberValues"] = {},
): BlockInstance {
  return {
    typeFqn: AGENTIC_OPERATION_FQN,
    memberValues,
  };
}

function literal(value: string): BlockInstance["memberValues"][string] {
  return {
    kind: "literal",
    value,
    typeFqn: TEXT_TYPE_FQN,
    authoredPlacement: "element",
  };
}

describe("AgenticOperation.metaPrompt", () => {
  it("uses the type default when the instance does not author it", () => {
    const { registry } = bootstrapFullProjectRegistry({ rootDir: WORKSPACE_ROOT });
    expect(getEffectiveOperationText(operation(), "metaPrompt", registry)).toBe(
      DEFAULT_META,
    );
  });

  it("uses an instance override, including empty", () => {
    const { registry } = bootstrapFullProjectRegistry({ rootDir: WORKSPACE_ROOT });
    expect(
      getEffectiveOperationText(
        operation({ metaPrompt: literal("Custom framing:") }),
        "metaPrompt",
        registry,
      ),
    ).toBe("Custom framing:");
    expect(
      getEffectiveOperationText(
        operation({ metaPrompt: literal("") }),
        "metaPrompt",
        registry,
      ),
    ).toBe("");
  });
});

describe("AgenticExecutor metaPrompt", () => {
  beforeEach(() => {
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(TMP, { recursive: true });
  });

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it("hands an authored override to the agent", async () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml":
        pendingExecutionXml({
          name: "JokeTest",
          metaPrompt: "Custom framing:",
        }),
    });
    let captured: { metaPrompt?: string; taskSnippet: string } | undefined;
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: {
        async execute(request) {
          captured = {
            metaPrompt: request.metaPrompt,
            taskSnippet: request.taskSnippet,
          };
          return { success: true };
        },
      },
      now: () => FIXED_NOW,
    });
    const result = await transformer.run(pendingFqn("JokeTest"));
    expect(result.success).toBe(true);
    expect(captured?.metaPrompt).toBe("Custom framing:");
    expect(captured?.taskSnippet).toContain("Do the task.");
  });

  it("hands an empty authored metaPrompt so the agent gets snippet only", async () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml":
        pendingExecutionXml({
          name: "JokeTest",
          metaPrompt: "",
        }),
    });
    let metaPrompt: string | undefined;
    const transformer = new Transformer({
      workspaceRoot: TMP,
      agent: {
        async execute(request) {
          metaPrompt = request.metaPrompt;
          return { success: true };
        },
      },
      now: () => FIXED_NOW,
    });
    const result = await transformer.run(pendingFqn("JokeTest"));
    expect(result.success).toBe(true);
    expect(metaPrompt).toBe("");
  });
});
