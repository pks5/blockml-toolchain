import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseArgs, runCli } from "../src/cli.js";
import type { TransformationAgent } from "@blockml/transformer";

const TMP = join(import.meta.dirname, ".tmp-cli-transform");
const LIBRARY = "com.example.model";

function pendingXml(name: string): string {
  return [
    `<block xmlns="http://blockml.org/bml"`,
    ` xmlns:core="org.blockml.bml.core"`,
    ` xmlns:workflow="org.blockml.bml.transformer.workflow"`,
    ` xmlns:pending="${LIBRARY}._transform.pending"`,
    ` xmlns:type="org.blockml.bml.type">`,
    `  <name>${name}</name>`,
    `  <type>pending:${name}</type>`,
    `  <baseType>workflow:TaskExecution</baseType>`,
    `  <is>pending execution fixture</is>`,
    `  <properties>`,
    `    <executionId override="true"><value>d41bf2a3-f51f-4171-a2e4-e71893c16f24</value></executionId>`,
    `  </properties>`,
    `  <aggregations>`,
    `    <task override="true">`,
    `      <composition>`,
    `        <workflow:InstructionTask instructions="Do the task." />`,
    `      </composition>`,
    `    </task>`,
    `  </aggregations>`,
    `</block>`,
    ``,
  ].join("\n");
}

function writeProject(): void {
  mkdirSync(join(TMP, "blocks/com/example/model/_transform/pending"), { recursive: true });
  writeFileSync(
    join(TMP, "package.json"),
    JSON.stringify({ name: "cli-transform-fixture", private: true }),
  );
  writeFileSync(
    join(TMP, "blocks/com/example/model/_transform/pending/JokeTest.bml"),
    pendingXml("JokeTest"),
  );
}

describe("parseArgs transform", () => {
  it("parses the execution FQN", () => {
    const parsed = parseArgs([
      "transform",
      "org.blockml.bml.workspace._transform.pending.JokeTest",
    ]);
    expect(parsed.command).toBe("transform");
    expect(parsed.executionFqn).toBe(
      "org.blockml.bml.workspace._transform.pending.JokeTest",
    );
  });

  it("maps transform --verbose", () => {
    const parsed = parseArgs([
      "transform",
      "org.blockml.bml.workspace._transform.pending.JokeTest",
      "--verbose",
    ]);
    expect(parsed.verbose).toBe(true);
    expect(parsed.executionFqn).toBe(
      "org.blockml.bml.workspace._transform.pending.JokeTest",
    );
  });
});

describe("blockml transform CLI", () => {
  beforeEach(() => {
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(TMP, { recursive: true });
    writeProject();
  });

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it("returns non-zero on failed execution and leaves the execution running", async () => {
    const failing: TransformationAgent = {
      async execute() {
        return { success: false, exitCode: 1, error: "claude failed" };
      },
    };
    const { code, stderr } = await runCli(
      ["transform", `${LIBRARY}._transform.pending.JokeTest`],
      TMP,
      { transformAgent: failing },
    );
    expect(code).toBe(1);
    expect(stderr).toMatch(/claude failed/);
    expect(
      existsSync(join(TMP, "blocks/com/example/model/_transform/pending/JokeTest.bml")),
    ).toBe(false);
    const runningDir = join(TMP, "blocks/com/example/model/_transform/running");
    expect(existsSync(runningDir)).toBe(true);
  });

  it("returns 2 when the FQN is missing", async () => {
    const { code } = await runCli(["transform"], TMP, {
      transformAgent: {
        async execute() {
          return { success: true };
        },
      },
    });
    expect(code).toBe(2);
  });
});
