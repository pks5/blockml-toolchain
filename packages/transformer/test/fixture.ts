import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { TransformationAgent } from "../src/agent/transformation-agent.js";

export const LIBRARY = "com.example.model";
export const EXECUTION_ID = "d41bf2a3-f51f-4171-a2e4-e71893c16f24";
export const FIXED_NOW = new Date(2026, 7, 30, 1, 17, 2);

export function pendingFqn(name: string): string {
  return `${LIBRARY}._meta.transform.pending.${name}`;
}

export function writeProject(dir: string, files: Record<string, string>): void {
  mkdirSync(join(dir, "blocks"), { recursive: true });
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "transformer-fixture", private: true }, null, 2),
  );
  for (const [rel, contents] of Object.entries(files)) {
    const path = join(dir, rel);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, contents);
  }
  commitFixture(dir);
}

export function gitHead(dir: string): string {
  return gitOrThrow(dir, ["rev-parse", "HEAD"]).trim();
}

export function gitParent(dir: string): string {
  return gitOrThrow(dir, ["rev-parse", "HEAD^"]).trim();
}

export function gitLogSubjects(dir: string): string[] {
  const stdout = gitOrThrow(dir, ["log", "--pretty=%s"]);
  return stdout.trim().length === 0 ? [] : stdout.trim().split("\n");
}

function commitFixture(dir: string, message = "fixture"): void {
  if (!existsSync(join(dir, ".git"))) {
    gitOrThrow(dir, ["init"]);
    gitOrThrow(dir, ["config", "user.email", "transformer@test"]);
    gitOrThrow(dir, ["config", "user.name", "Transformer Test"]);
  }
  const gitignore = join(dir, ".gitignore");
  if (!existsSync(gitignore)) {
    writeFileSync(gitignore, ".blockml/\n");
  }
  gitOrThrow(dir, ["add", "-A"]);
  const cached = spawnSync("git", ["diff", "--cached", "--quiet"], {
    cwd: dir,
    encoding: "utf8",
  });
  if (cached.status === 0) {
    return;
  }
  gitOrThrow(dir, ["-c", "commit.gpgsign=false", "commit", "-m", message]);
}

function gitOrThrow(dir: string, args: string[]): string {
  const result = spawnSync("git", args, { cwd: dir, encoding: "utf8" });
  if (result.error || (result.status ?? 1) !== 0) {
    throw new Error(
      `git ${args.join(" ")} failed: ${result.stderr || result.error?.message || ""}`,
    );
  }
  return result.stdout ?? "";
}

export function pendingExecutionXml(opts: {
  name: string;
  executionId?: string;
  extraRefs?: string;
  stageInstructions?: readonly string[];
  template?: boolean;
  parameterFields?: readonly string[];
  pendingParameters?: string;
  captureOutput?: boolean;
  resultSource?: string;
  parametersSource?: string;
}): string {
  const refs = opts.extraRefs
    ? `  <references>\n${opts.extraRefs}\n  </references>\n`
    : "";
  const executionIdXml = opts.executionId
    ? [
        `    <executionId override="true" type="org.blockml.bml.type.UUID">`,
        `      <value>${opts.executionId}</value>`,
        `    </executionId>`,
      ].join("\n")
    : "";
  const templateXml =
    opts.template === true
      ? [
          `    <template override="true" type="org.blockml.bml.type.Boolean">`,
          `      <value>true</value>`,
          `    </template>`,
        ].join("\n")
      : "";
  const pendingParametersXml = opts.pendingParameters
    ? [
        `    <parameters override="true">`,
        `      <value>${opts.pendingParameters}</value>`,
        `    </parameters>`,
      ].join("\n")
    : "";
  const resultSourceXml = opts.resultSource
    ? [
        `    <resultSource override="true" type="org.blockml.bml.type.PropertyReference">`,
        `      <value>${opts.resultSource}</value>`,
        `    </resultSource>`,
      ].join("\n")
    : "";
  const parametersSourceXml = opts.parametersSource
    ? [
        `    <parametersSource override="true" type="org.blockml.bml.type.PropertyReference">`,
        `      <value>${opts.parametersSource}</value>`,
        `    </parametersSource>`,
      ].join("\n")
    : "";
  const parameterFields = opts.parameterFields ?? [];
  const bindParameters = parameterFields.length > 0;
  const baseType = bindParameters
    ? "workflow:ModelTransformation(Parameters)"
    : "workflow:ModelTransformation";
  const parameterBlock = bindParameters
    ? [
        `    <block>`,
        `      <name>Parameters</name>`,
        `      <baseType>type:StructType</baseType>`,
        `      <is>parameters for this transformation</is>`,
        `      <properties>`,
        ...parameterFields.map(
          (field) => `        <${field} type="type:Text" />`,
        ),
        `      </properties>`,
        `    </block>`,
      ]
    : [];
  const subBlocks =
    parameterBlock.length > 0
      ? [`  <subBlocks>`, ...parameterBlock, `  </subBlocks>`].join("\n")
      : "";
  const instructions = opts.stageInstructions ?? ["Do the task."];
  const stages = instructions
    .map((text) =>
      [
        `        <workflow:Stage>`,
        `          <status>Pending</status>`,
        ...(opts.captureOutput === true
          ? [`          <captureOutput>true</captureOutput>`]
          : []),
        `          <task>`,
        `            <workflow:InstructionTask instructions="${text}" />`,
        `          </task>`,
        `        </workflow:Stage>`,
      ].join("\n"),
    )
    .join("\n");
  return [
    `<block xmlns="http://blockml.org/bml"`,
    ` xmlns:core="org.blockml.bml.core"`,
    ` xmlns:workflow="org.blockml.bml.transformer.workflow"`,
    ` xmlns:pending="${LIBRARY}._meta.transform.pending"`,
    ` xmlns:type="org.blockml.bml.type">`,
    `  <name>${opts.name}</name>`,
    `  <type>pending:${opts.name}</type>`,
    `  <baseType>${baseType}</baseType>`,
    `  <is>pending execution fixture</is>`,
    refs,
    subBlocks,
    `  <properties>`,
    executionIdXml,
    templateXml,
    pendingParametersXml,
    parametersSourceXml,
    resultSourceXml,
    `    <status override="true" type="org.blockml.bml.transformer.workflow.ExecutionStatus">`,
    `      <value>Pending</value>`,
    `    </status>`,
    `    <createdAt override="true" type="org.blockml.bml.type.DateTime">`,
    `      <value>2026-08-30T01:17:02</value>`,
    `    </createdAt>`,
    `  </properties>`,
    `  <aggregations>`,
    `    <stages override="true">`,
    `      <composition>`,
    stages,
    `      </composition>`,
    `    </stages>`,
    `  </aggregations>`,
    `</block>`,
    ``,
  ].join("\n");
}

export function historyExecutionXml(opts: {
  name: string;
  stage: "running" | "succeeded" | "failed";
  executionId: string;
  sequence: number;
}): string {
  return [
    `<block xmlns="http://blockml.org/bml"`,
    ` xmlns:core="org.blockml.bml.core"`,
    ` xmlns:workflow="org.blockml.bml.transformer.workflow"`,
    ` xmlns:${opts.stage}="${LIBRARY}._meta.transform.${opts.stage}"`,
    ` xmlns:type="org.blockml.bml.type">`,
    `  <name>${opts.name}</name>`,
    `  <type>${opts.stage}:${opts.name}</type>`,
    `  <baseType>workflow:ModelTransformation</baseType>`,
    `  <is>history execution fixture</is>`,
    `  <properties>`,
    `    <executionId override="true" type="org.blockml.bml.type.UUID"><value>${opts.executionId}</value></executionId>`,
    `    <sequence override="true"><value>${opts.sequence}</value></sequence>`,
    `  </properties>`,
    `  <aggregations>`,
    `    <stages override="true">`,
    `      <composition>`,
    `        <workflow:Stage>`,
    `          <status>Pending</status>`,
    `          <task>`,
    `            <workflow:InstructionTask instructions="Already ran." />`,
    `          </task>`,
    `        </workflow:Stage>`,
    `      </composition>`,
    `    </stages>`,
    `  </aggregations>`,
    `</block>`,
    ``,
  ].join("\n");
}

export function resultSourceBlockXml(opts: {
  name: string;
  properties: readonly { name: string; type: string; value: string }[];
}): string {
  return [
    `<block xmlns="http://blockml.org/bml"`,
    ` xmlns:core="org.blockml.bml.core"`,
    ` xmlns:type="org.blockml.bml.type"`,
    ` xmlns:test="${LIBRARY}">`,
    `  <name>${opts.name}</name>`,
    `  <type>test:${opts.name}</type>`,
    `  <baseType>core:Block</baseType>`,
    `  <is>result source fixture</is>`,
    `  <properties>`,
    ...opts.properties.flatMap((property) => [
      `    <${property.name} type="${property.type}">`,
      `      <value>${property.value}</value>`,
      `    </${property.name}>`,
    ]),
    `  </properties>`,
    `</block>`,
    ``,
  ].join("\n");
}

export function plainBlockXml(name: string): string {
  return [
    `<block xmlns="http://blockml.org/bml"`,
    ` xmlns:core="org.blockml.bml.core"`,
    ` xmlns:test="${LIBRARY}">`,
    `  <name>${name}</name>`,
    `  <type>test:${name}</type>`,
    `  <baseType>core:Block</baseType>`,
    `  <is>not a ModelTransformation</is>`,
    `</block>`,
    ``,
  ].join("\n");
}

export function referrerXml(name: string, seeType: string): string {
  return [
    `<block xmlns="http://blockml.org/bml"`,
    ` xmlns:core="org.blockml.bml.core"`,
    ` xmlns:pending="${LIBRARY}._meta.transform.pending"`,
    ` xmlns:test="${LIBRARY}">`,
    `  <name>${name}</name>`,
    `  <type>test:${name}</type>`,
    `  <baseType>core:Block</baseType>`,
    `  <is>refers to a pending execution</is>`,
    `  <references>`,
    `    <see type="${seeType}" relation="SeeAlso" />`,
    `  </references>`,
    `</block>`,
    ``,
  ].join("\n");
}

export function successfulAgent(): TransformationAgent {
  return {
    async execute() {
      return { success: true };
    },
  };
}

export function failingAgent(error = "agent failed"): TransformationAgent {
  return {
    async execute() {
      return { success: false, exitCode: 1, error };
    },
  };
}

export function recordingAgent(calls: string[]): TransformationAgent {
  return {
    async execute(request) {
      calls.push(request.executionFqn);
      return { success: true };
    },
  };
}
