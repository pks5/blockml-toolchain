import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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
    ` xmlns:pending="${LIBRARY}._meta.transform.pending"`,
    ` xmlns:type="org.blockml.bml.type">`,
    `  <name>${name}</name>`,
    `  <type>pending:${name}</type>`,
    `  <baseType>workflow:ModelTransformation</baseType>`,
    `  <is>pending execution fixture</is>`,
    `  <properties>`,
    `    <status override="true" type="org.blockml.bml.transformer.workflow.ExecutionStatus">`,
    `      <value>Pending</value>`,
    `    </status>`,
    `    <createdAt override="true" type="org.blockml.bml.type.DateTime">`,
    `      <value>2026-08-30T01:17:02</value>`,
    `    </createdAt>`,
    `  </properties>`,
    `  <aggregations>`,
    `    <operations override="true">`,
    `      <composition>`,
        `        <workflow:AgenticOperation>`,
    `          <status>Pending</status>`,
    `          <task>`,
    `            <workflow:InstructionTask instructions="Do the task." />`,
    `          </task>`,
        `        </workflow:AgenticOperation>`,
    `      </composition>`,
    `    </operations>`,
    `  </aggregations>`,
    `</block>`,
    ``,
  ].join("\n");
}

function writeProject(): void {
  mkdirSync(join(TMP, "blocks/com/example/model/_meta/transform/pending"), { recursive: true });
  writeFileSync(
    join(TMP, "package.json"),
    JSON.stringify({
      name: "cli-transform-fixture",
      private: true,
      blockml: { library: "./blocks/com/example/model/Library.bml" },
    }),
  );
  writeFileSync(
    join(TMP, "blocks/com/example/model/Library.bml"),
    [
      `<block xmlns="http://blockml.org/bml"`,
      ` xmlns:core="org.blockml.bml.core"`,
      ` xmlns:model="${LIBRARY}">`,
      `  <name>Library</name>`,
      `  <type>model:Library</type>`,
      `  <baseType>core:BlockLibrary</baseType>`,
      `  <is>fixture library</is>`,
      `</block>`,
      ``,
    ].join("\n"),
  );
  writeFileSync(
    join(TMP, "blocks/com/example/model/_meta/transform/pending/JokeTest.bml"),
    pendingXml("JokeTest"),
  );
  writeFileSync(join(TMP, ".gitignore"), ".blockml/\n");
  gitOrThrow(["init"]);
  gitOrThrow(["config", "user.email", "transformer@test"]);
  gitOrThrow(["config", "user.name", "Transformer Test"]);
  gitOrThrow(["add", "-A"]);
  gitOrThrow(["-c", "commit.gpgsign=false", "commit", "-m", "fixture"]);
}

function gitOrThrow(args: string[]): void {
  const result = spawnSync("git", args, { cwd: TMP, encoding: "utf8" });
  if (result.error || (result.status ?? 1) !== 0) {
    throw new Error(
      `git ${args.join(" ")} failed: ${result.stderr || result.error?.message || ""}`,
    );
  }
}

describe("parseArgs transform", () => {
  it("parses transform apply and the execution FQN", () => {
    const parsed = parseArgs([
      "transform",
      "apply",
      "org.blockml.bml.workspace._meta.transform.pending.JokeTest",
    ]);
    expect(parsed.command).toBe("transform");
    expect(parsed.subcommand).toBe("apply");
    expect(parsed.executionFqn).toBe(
      "org.blockml.bml.workspace._meta.transform.pending.JokeTest",
    );
  });

  it("maps transform --verbose before apply", () => {
    const parsed = parseArgs([
      "transform",
      "--verbose",
      "apply",
      "org.blockml.bml.workspace._meta.transform.pending.JokeTest",
    ]);
    expect(parsed.verbose).toBe(true);
    expect(parsed.subcommand).toBe("apply");
    expect(parsed.executionFqn).toBe(
      "org.blockml.bml.workspace._meta.transform.pending.JokeTest",
    );
  });

  it("parses transform apply --parameters JSON", () => {
    const parsed = parseArgs([
      "transform",
      "apply",
      "org.blockml.bml.workspace._meta.transform.pending.JokeTest",
      "--parameters",
      '{"language":"de"}',
    ]);
    expect(parsed.parametersJson).toBe('{"language":"de"}');
  });

  it("parses transform apply --parameter-mappings", () => {
    const parsed = parseArgs([
      "transform",
      "apply",
      "org.blockml.bml.workspace._meta.transform.pending.JokeTest",
      "--parameter-mappings",
      '[{"source":"com.example.model.Poem.properties.title"}]',
    ]);
    expect(parsed.parameterMappingsJson).toBe(
      '[{"source":"com.example.model.Poem.properties.title"}]',
    );
  });

  it("parses transform apply --library", () => {
    const parsed = parseArgs([
      "transform",
      "apply",
      "org.blockml.bml.transformer.program.CreateTransformation",
      "--library",
      "./blocks/org/blockml/bml/workspace/Library.bml",
    ]);
    expect(parsed.library).toBe("./blocks/org/blockml/bml/workspace/Library.bml");
    expect(parsed.libraries).toBeUndefined();
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

  it("returns non-zero on failed execution and relocates the execution to failed", async () => {
    const failing: TransformationAgent = {
      async execute() {
        return { success: false, exitCode: 1, error: "claude failed" };
      },
    };
    const { code, stderr } = await runCli(
      ["transform", "apply", `${LIBRARY}._meta.transform.pending.JokeTest`],
      TMP,
      { transformAgent: failing },
    );
    expect(code).toBe(1);
    expect(stderr).toMatch(/claude failed/);
    expect(stderr).toMatch(/Operation 1\/1 Running/);
    expect(stderr).toMatch(/Operation 1\/1 execute start/);
    expect(stderr).toMatch(/ModelTransformation Failed/);
    expect(stderr).toMatch(/Elapsed /);
    expect(
      existsSync(join(TMP, "blocks/com/example/model/_meta/transform/pending/JokeTest.bml")),
    ).toBe(false);
    const failedDir = join(TMP, "blocks/com/example/model/_meta/transform/failed");
    expect(readdirSync(failedDir).some((name) => name.endsWith(".bml"))).toBe(true);
  });

  it("returns 2 when the subcommand is missing", async () => {
    const { code, stderr } = await runCli(["transform"], TMP, {
      transformAgent: {
        async execute() {
          return { success: true };
        },
      },
    });
    expect(code).toBe(2);
    expect(stderr).toMatch(/Specify a transform subcommand/);
  });

  it("returns 2 when the subcommand is unknown", async () => {
    const { code, stderr } = await runCli(["transform", "preview"], TMP, {
      transformAgent: {
        async execute() {
          return { success: true };
        },
      },
    });
    expect(code).toBe(2);
    expect(stderr).toMatch(/Unknown transform subcommand: preview/);
  });

  it("returns 2 when the FQN is missing", async () => {
    const { code } = await runCli(["transform", "apply"], TMP, {
      transformAgent: {
        async execute() {
          return { success: true };
        },
      },
    });
    expect(code).toBe(2);
  });

  it("prints Operation lifecycle lines without --verbose on success", async () => {
    const { code, stderr } = await runCli(
      ["transform", "apply", `${LIBRARY}._meta.transform.pending.JokeTest`],
      TMP,
      {
        transformAgent: {
          async execute() {
            return { success: true };
          },
        },
      },
    );
    expect(code).toBe(0);
    expect(stderr).toMatch(/ModelTransformation Running/);
    expect(stderr).toMatch(/Operation 1\/1 Running/);
    expect(stderr).toMatch(/Operation 1\/1 execute start/);
    expect(stderr).toMatch(/Operation 1\/1 execute done/);
    expect(stderr).toMatch(/Operation 1\/1 Succeeded/);
    expect(stderr).toMatch(/ModelTransformation Succeeded/);
    expect(stderr).toMatch(/Transformed /);
    expect(stderr).toMatch(/Elapsed /);
    expect(stderr).not.toMatch(/--verbose/);
  });

  it("returns 2 when cwd has no blockml.library and --library is omitted", async () => {
    writeFileSync(
      join(TMP, "package.json"),
      JSON.stringify({ name: "cli-transform-fixture", private: true }),
    );
    gitOrThrow(["add", "-A"]);
    gitOrThrow(["-c", "commit.gpgsign=false", "commit", "-m", "drop library"]);
    const { code, stderr } = await runCli(
      ["transform", "apply", `${LIBRARY}._meta.transform.pending.JokeTest`],
      TMP,
      {
        transformAgent: {
          async execute() {
            return { success: true };
          },
        },
      },
    );
    expect(code).toBe(2);
    expect(stderr).toMatch(/blockml\.library/);
  });

  it("writes _meta under --library", async () => {
    mkdirSync(join(TMP, "blocks/com/other/target"), { recursive: true });
    writeFileSync(
      join(TMP, "blocks/com/other/target/Library.bml"),
      [
        `<block xmlns="http://blockml.org/bml"`,
        ` xmlns:core="org.blockml.bml.core"`,
        ` xmlns:other="com.other.target">`,
        `  <name>Library</name>`,
        `  <type>other:Library</type>`,
        `  <baseType>core:BlockLibrary</baseType>`,
        `  <is>other fixture library</is>`,
        `</block>`,
        ``,
      ].join("\n"),
    );
    gitOrThrow(["add", "-A"]);
    gitOrThrow(["-c", "commit.gpgsign=false", "commit", "-m", "other library"]);
    const { code } = await runCli(
      [
        "transform",
        "apply",
        `${LIBRARY}._meta.transform.pending.JokeTest`,
        "--library",
        "blocks/com/other/target/Library.bml",
      ],
      TMP,
      {
        transformAgent: {
          async execute() {
            return { success: true };
          },
        },
      },
    );
    expect(code).toBe(0);
    const succeededDir = join(TMP, "blocks/com/other/target/_meta/transform/succeeded");
    expect(readdirSync(succeededDir).some((name) => name.endsWith(".bml"))).toBe(true);
  });
});
