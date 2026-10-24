import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseArgs, runCli } from "../src/cli.js";
import { renderAgentsMarkdown } from "../src/run-agents-md.js";

const TMP = join(tmpdir(), "blockml-cli-agents-md-test");

const AGENT_BASE = `<core:AgentInstructions xmlns="http://blockml.org/bml"
  xmlns:core="org.blockml.bml.core"
  xmlns:type="org.blockml.bml.type">

  <baseType>core:Block</baseType>
  <is>A part of a generated AGENTS.md</is>
  <properties>
    <order type="type:Integer">
      <value>1000</value>
    </order>
  </properties>
  <aggregations>
    <sections type="core:AgentInstructions.Section[]" />
  </aggregations>
  <subBlocks>
    <Section>
      <baseType>core:Block</baseType>
      <is>A section of Agent Instructions</is>
      <properties>
        <title type="type:Text" />
        <content type="type:Text" />
      </properties>
    </Section>
  </subBlocks>
</core:AgentInstructions>
`;

describe("renderAgentsMarkdown", () => {
  it("uses a level-1 heading for every section, then a Rules list", () => {
    expect(
      renderAgentsMarkdown(
        [
          { title: "Early", content: "from project\n" },
          { title: "Later", content: "  more  \n" },
        ],
        ["keep scope", "stay on one line\nand the next"],
      ),
    ).toBe(
      "# Early\n\nfrom project\n\n# Later\n\n  more\n\n# Rules\n\n- keep scope\n- stay on one line\n  and the next\n",
    );
  });
});

describe("parseArgs agents-md", () => {
  it("maps the generate subcommand and --src", () => {
    const parsed = parseArgs(["agents-md", "generate", "--src", "sources"]);
    expect(parsed.command).toBe("agents-md");
    expect(parsed.subcommand).toBe("generate");
    expect(parsed.srcDir).toBe("sources");
  });
});

describe("blockml agents-md generate", () => {
  beforeEach(() => {
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(TMP, { recursive: true });
  });

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it("sorts project blocks and direct devDependencies, skipping transitive and non-library packages", async () => {
    writeFileSync(
      join(TMP, "package.json"),
      JSON.stringify({
        name: "fixture",
        dependencies: { "plain-lib": "1.0.0" },
        devDependencies: { "dev-lib": "1.0.0" },
        optionalDependencies: { "sneak-lib": "1.0.0" },
      }),
    );
    writeBml(TMP, "blocks/org/blockml/bml/core/AgentInstructions.bml", AGENT_BASE);
    writeInstructions(
      TMP,
      "blocks/com/example/bml/Early.bml",
      "com.example.bml",
      "Early",
      10,
      [
        ["Early", "from project"],
        ["Second", "more"],
      ],
      ["early rule"],
    );
    writeInstructions(TMP, "blocks/com/example/bml/TieB.bml", "com.example.bml", "TieB", 50, [
      ["TieB", "b"],
    ], ["b rule"]);
    writeInstructions(TMP, "blocks/com/example/bml/TieA.bml", "com.example.bml", "TieA", 50, [
      ["TieA", "a"],
    ], ["a rule"]);
    writeInstructions(TMP, "blocks/com/example/bml/Unordered.bml", "com.example.bml", "Unordered", undefined, [
      ["Unordered", "fallback"],
    ]);
    writeInstructions(TMP, "blocks/com/example/bml/Late.bml", "com.example.bml", "Late", 2000, [
      ["Late", "from late"],
    ], ["late rule"]);

    writePackageInstructions(
      join(TMP, "node_modules/dev-lib"),
      "dev-lib",
      true,
      "Mid",
      100,
      "from dev",
      ["mid rule"],
    );
    writePackageInstructions(join(TMP, "node_modules/plain-lib"), "plain-lib", false, "Plain", 1, "plain");
    writePackageInstructions(join(TMP, "node_modules/sneak-lib"), "sneak-lib", true, "Sneak", 1, "sneak");
    writePackageInstructions(
      join(TMP, "node_modules/dev-lib/node_modules/hidden-lib"),
      "hidden-lib",
      true,
      "Hidden",
      1,
      "hidden",
    );
    writePackageInstructions(join(TMP, "node_modules/hidden-lib"), "hidden-lib", true, "Hoisted", 1, "hoisted");

    const { code, stderr } = await runCli(["agents-md", "generate"], TMP);
    expect(code, stderr).toBe(0);
    expect(stderr).toMatch(/Created AGENTS.md/);
    expect(readFileSync(join(TMP, "AGENTS.md"), "utf8")).toBe(
      [
        "# Early",
        "",
        "from project",
        "",
        "# Second",
        "",
        "more",
        "",
        "# TieA",
        "",
        "a",
        "",
        "# TieB",
        "",
        "b",
        "",
        "# Mid",
        "",
        "from dev",
        "",
        "# Unordered",
        "",
        "fallback",
        "",
        "# Late",
        "",
        "from late",
        "",
        "# Rules",
        "",
        "- early rule",
        "- a rule",
        "- b rule",
        "- mid rule",
        "- late rule",
        "",
      ].join("\n"),
    );
    expect(readFileSync(join(TMP, "AGENTS.md"), "utf8")).not.toMatch(/Plain|Sneak|Hidden|Hoisted/);
  });

  it("overwrites an existing AGENTS.md", async () => {
    writeFileSync(join(TMP, "package.json"), JSON.stringify({ name: "fixture" }));
    writeBml(TMP, "blocks/org/blockml/bml/core/AgentInstructions.bml", AGENT_BASE);
    writeInstructions(TMP, "blocks/com/example/bml/Only.bml", "com.example.bml", "Only", 1, [
      ["Only", "fresh"],
    ]);
    writeFileSync(join(TMP, "AGENTS.md"), "old\n");
    const { code, stderr } = await runCli(["agents-md", "generate"], TMP);
    expect(code, stderr).toBe(0);
    expect(stderr).toMatch(/Updated AGENTS.md/);
    expect(readFileSync(join(TMP, "AGENTS.md"), "utf8")).toBe("# Only\n\nfresh\n");
  });

  it("leaves an existing file when no sections are found", async () => {
    writeFileSync(join(TMP, "package.json"), JSON.stringify({ name: "fixture" }));
    writeFileSync(join(TMP, "AGENTS.md"), "keep\n");
    const { code, stderr } = await runCli(["agents-md", "generate"], TMP);
    expect(code).toBe(1);
    expect(stderr).toMatch(/No AgentInstructions blocks found/);
    expect(readFileSync(join(TMP, "AGENTS.md"), "utf8")).toBe("keep\n");
    expect(existsSync(join(TMP, "AGENTS.md"))).toBe(true);
  });

  it("uses --src and blockml.config.json srcDir for the project folder only", async () => {
    writeFileSync(join(TMP, "package.json"), JSON.stringify({ name: "fixture" }));
    writeFileSync(join(TMP, "blockml.config.json"), JSON.stringify({ srcDir: "sources" }));
    writeBml(TMP, "blocks/org/blockml/bml/core/AgentInstructions.bml", AGENT_BASE);
    writeInstructions(TMP, "blocks/com/example/bml/Decoy.bml", "com.example.bml", "Decoy", 1, [
      ["Decoy", "blocks"],
    ]);
    writeBml(TMP, "sources/org/blockml/bml/core/AgentInstructions.bml", AGENT_BASE);
    writeInstructions(TMP, "sources/com/example/bml/Chosen.bml", "com.example.bml", "Chosen", 1, [
      ["Chosen", "sources"],
    ]);

    const fromConfig = await runCli(["agents-md", "generate"], TMP);
    expect(fromConfig.code, fromConfig.stderr).toBe(0);
    expect(readFileSync(join(TMP, "AGENTS.md"), "utf8")).toBe("# Chosen\n\nsources\n");

    const fromFlag = await runCli(["agents-md", "generate", "--src", "blocks"], TMP);
    expect(fromFlag.code, fromFlag.stderr).toBe(0);
    expect(readFileSync(join(TMP, "AGENTS.md"), "utf8")).toBe("# Decoy\n\nblocks\n");
  });

  it("rejects a missing subcommand and prints help", async () => {
    const missing = await runCli(["agents-md"], TMP);
    expect(missing.code).toBe(2);
    expect(missing.stderr).toMatch(/blockml agents-md generate/);

    const help = await runCli(["agents-md", "--help"], TMP);
    expect(help.code).toBe(0);
    expect(help.stderr).toMatch(/When: rewrite AGENTS.md/);
    expect(help.stderr).toMatch(/direct/);
  });
});

function writePackageInstructions(
  packageDir: string,
  name: string,
  blockmlPackage: boolean,
  typeName: string,
  order: number,
  content: string,
  rules: string[] = [],
): void {
  mkdirSync(packageDir, { recursive: true });
  writeFileSync(
    join(packageDir, "package.json"),
    JSON.stringify(
      blockmlPackage
        ? { name, blockml: { library: `./blocks/com/example/bml/${typeName}.bml` } }
        : { name },
    ),
  );
  writeInstructions(
    packageDir,
    `blocks/com/example/bml/${typeName}.bml`,
    "com.example.bml",
    typeName,
    order,
    [[typeName, content]],
    rules,
  );
}

function writeInstructions(
  root: string,
  rel: string,
  packageFqn: string,
  typeName: string,
  order: number | undefined,
  sections: [string, string][],
  rules: string[] = [],
): void {
  const prefix = "ex";
  const orderXml =
    order === undefined
      ? ""
      : `  <properties>
    <order type="type:Integer" override="true">
      <value>${order}</value>
    </order>
  </properties>
`;
  const sectionXml = sections
    .map(
      ([title, content]) => `        <core:AgentInstructions.Section title="${title}">
          <content>${content}</content>
        </core:AgentInstructions.Section>`,
    )
    .join("\n");
  const rulesXml =
    rules.length === 0
      ? ""
      : `    <rules override="true">
      <composition>
${rules
  .map(
    (content) => `        <core:AgentInstructions.Rule>
          <content>${content}</content>
        </core:AgentInstructions.Rule>`,
  )
  .join("\n")}
      </composition>
    </rules>
`;
  writeBml(
    root,
    rel,
    `<${prefix}:${typeName} xmlns="http://blockml.org/bml"
  xmlns:core="org.blockml.bml.core"
  xmlns:${prefix}="${packageFqn}"
  xmlns:type="org.blockml.bml.type">

  <baseType>core:AgentInstructions</baseType>
  <is>${typeName} instructions</is>
${orderXml}  <aggregations>
    <sections override="true">
      <composition>
${sectionXml}
      </composition>
    </sections>
${rulesXml}  </aggregations>
</${prefix}:${typeName}>
`,
  );
}

function writeBml(root: string, rel: string, text: string): void {
  const path = join(root, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, "utf8");
}
