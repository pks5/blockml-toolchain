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

export const LIBRARY_FILE = "blocks/com/example/model/Library.bml";

export function fixtureLibraryXml(packageFqn = LIBRARY): string {
  const prefix = "model";
  return [
    `<block xmlns="http://blockml.org/bml"`,
    ` xmlns:core="org.blockml.bml.core"`,
    ` xmlns:${prefix}="${packageFqn}">`,
    `  <name>Library</name>`,
    `  <type>${prefix}:Library</type>`,
    `  <baseType>core:BlockLibrary</baseType>`,
    `  <is>fixture library</is>`,
    `</block>`,
    ``,
  ].join("\n");
}

export function writeProject(dir: string, files: Record<string, string>): void {
  mkdirSync(join(dir, "blocks"), { recursive: true });
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify(
      {
        name: "transformer-fixture",
        private: true,
        blockml: { library: `./${LIBRARY_FILE}` },
      },
      null,
      2,
    ),
  );
  const withLibrary = {
    [LIBRARY_FILE]: fixtureLibraryXml(),
    ...files,
  };
  for (const [rel, contents] of Object.entries(withLibrary)) {
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

export type ResultMappingSpec = {
  source: string;
  sourcePath?: string;
  resultPath?: string;
};

export type ParameterMappingSpec = {
  source: string;
  sourcePath?: string;
  parameterPath?: string;
};

export function pendingExecutionXml(opts: {
  name: string;
  executionId?: string;
  extraRefs?: string;
  operationInstructions?: readonly string[];
  template?: boolean;
  parameterFields?: readonly string[];
  pendingParameters?: string;
  captureOutput?: boolean;
  resultMappings?: readonly ResultMappingSpec[];
  resultType?: string;
  resultFields?: readonly { name: string; type: string }[];
  parameterMappings?: readonly ParameterMappingSpec[];
  tool?: { command: string; args?: readonly string[] };
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
  const parameterFields = opts.parameterFields ?? [];
  const bindParameters = parameterFields.length > 0;
  const resultType = opts.resultType;
  const baseType = resultType
    ? bindParameters
      ? `workflow:ModelTransformation(Parameters, ${resultType})`
      : `workflow:ModelTransformation(type:Text, ${resultType})`
    : bindParameters
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
  const resultBlock = (opts.resultFields ?? []).length > 0
    ? [
        `    <block>`,
        `      <name>Result</name>`,
        `      <baseType>type:StructType</baseType>`,
        `      <is>result struct for this transformation</is>`,
        `      <properties>`,
        ...(opts.resultFields ?? []).map(
          (field) => `        <${field.name} type="${field.type}" />`,
        ),
        `      </properties>`,
        `    </block>`,
      ]
    : [];
  const nestedBlocks = [...parameterBlock, ...resultBlock];
  const subBlocks =
    nestedBlocks.length > 0
      ? [`  <subBlocks>`, ...nestedBlocks, `  </subBlocks>`].join("\n")
      : "";
  const instructions = opts.operationInstructions ?? ["Do the task."];
  const capture =
    opts.captureOutput === true
      ? [`          <captureOutput>true</captureOutput>`]
      : [];
  const mappings = resultMappingsXml(opts.resultMappings);
  const operations = opts.tool
    ? [
        `        <workflow:ToolOperation name="Validate" command="${opts.tool.command}">`,
        `          <status>Pending</status>`,
        ...capture,
        ...(opts.tool.args !== undefined
          ? [`          <args>${JSON.stringify([...opts.tool.args])}</args>`]
          : []),
        ...mappings,
        `        </workflow:ToolOperation>`,
      ].join("\n")
    : instructions
        .map((text, index) =>
          [
            `        <workflow:AgenticOperation>`,
            `          <status>Pending</status>`,
            ...capture,
            ...(index === instructions.length - 1 ? mappings : []),
            `          <task>`,
            `            <workflow:InstructionTask instructions="${text}" />`,
            `          </task>`,
            `        </workflow:AgenticOperation>`,
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
    `    <status override="true" type="org.blockml.bml.transformer.workflow.ExecutionStatus">`,
    `      <value>Pending</value>`,
    `    </status>`,
    `    <createdAt override="true" type="org.blockml.bml.type.DateTime">`,
    `      <value>2026-08-30T01:17:02</value>`,
    `    </createdAt>`,
    `  </properties>`,
    `  <aggregations>`,
    ...parameterMappingsXml(opts.parameterMappings),
    `    <operations override="true">`,
    `      <composition>`,
    operations,
    `      </composition>`,
    `    </operations>`,
    `  </aggregations>`,
    `</block>`,
    ``,
  ].join("\n");
}

function parameterMappingsXml(
  mappings: readonly ParameterMappingSpec[] | undefined,
): string[] {
  if (!mappings || mappings.length === 0) {
    return [];
  }
  return [
    `    <parameterMappings override="true">`,
    `      <composition>`,
    ...mappings.flatMap((mapping) => [
      `        <workflow:ParameterMapping>`,
      `          <source>${mapping.source}</source>`,
      ...(mapping.sourcePath
        ? [`          <sourcePath>${mapping.sourcePath}</sourcePath>`]
        : []),
      ...(mapping.parameterPath
        ? [`          <parameterPath>${mapping.parameterPath}</parameterPath>`]
        : []),
      `        </workflow:ParameterMapping>`,
    ]),
    `      </composition>`,
    `    </parameterMappings>`,
  ];
}

function resultMappingsXml(
  mappings: readonly ResultMappingSpec[] | undefined,
): string[] {
  if (!mappings || mappings.length === 0) {
    return [];
  }
  return [
    `          <resultMappings>`,
    ...mappings.flatMap((mapping) => [
      `            <workflow:ResultMapping>`,
      `              <source>${mapping.source}</source>`,
      ...(mapping.sourcePath
        ? [`              <sourcePath>${mapping.sourcePath}</sourcePath>`]
        : []),
      ...(mapping.resultPath
        ? [`              <resultPath>${mapping.resultPath}</resultPath>`]
        : []),
      `            </workflow:ResultMapping>`,
    ]),
    `          </resultMappings>`,
  ];
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
    `    <operations override="true">`,
    `      <composition>`,
    `        <workflow:AgenticOperation>`,
    `          <status>Pending</status>`,
    `          <task>`,
    `            <workflow:InstructionTask instructions="Already ran." />`,
    `          </task>`,
    `        </workflow:AgenticOperation>`,
    `      </composition>`,
    `    </operations>`,
    `  </aggregations>`,
    `</block>`,
    ``,
  ].join("\n");
}

export function resultSourceBlockXml(opts: {
  name: string;
  properties: readonly { name: string; type: string; value: string }[];
  structs?: readonly { name: string; fields: readonly { name: string; type: string }[] }[];
}): string {
  const structs = opts.structs ?? [];
  const subBlocks =
    structs.length > 0
      ? [
          `  <subBlocks>`,
          ...structs.flatMap((struct) => [
            `    <block>`,
            `      <name>${struct.name}</name>`,
            `      <baseType>type:StructType</baseType>`,
            `      <is>${struct.name} struct</is>`,
            `      <properties>`,
            ...struct.fields.map(
              (field) => `        <${field.name} type="${field.type}" />`,
            ),
            `      </properties>`,
            `    </block>`,
          ]),
          `  </subBlocks>`,
        ]
      : [];
  return [
    `<block xmlns="http://blockml.org/bml"`,
    ` xmlns:core="org.blockml.bml.core"`,
    ` xmlns:type="org.blockml.bml.type"`,
    ` xmlns:test="${LIBRARY}">`,
    `  <name>${opts.name}</name>`,
    `  <type>test:${opts.name}</type>`,
    `  <baseType>core:Block</baseType>`,
    `  <is>result source fixture</is>`,
    ...subBlocks,
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
      calls.push(request.taskSnippet);
      return { success: true };
    },
  };
}
