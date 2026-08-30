import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { TransformationAgent } from "../src/agent/transformation-agent.js";

export const LIBRARY = "com.example.model";
export const EXECUTION_ID = "d41bf2a3-f51f-4171-a2e4-e71893c16f24";
export const FIXED_NOW = new Date(2026, 7, 30, 1, 17, 2);

export function pendingFqn(name: string): string {
  return `${LIBRARY}._transform.pending.${name}`;
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
}

export function pendingExecutionXml(opts: {
  name: string;
  executionId?: string;
  extraRefs?: string;
}): string {
  const executionId = opts.executionId ?? EXECUTION_ID;
  const refs = opts.extraRefs
    ? `  <references>\n${opts.extraRefs}\n  </references>\n`
    : "";
  return [
    `<block xmlns="http://blockml.org/bml"`,
    ` xmlns:core="org.blockml.bml.core"`,
    ` xmlns:workflow="org.blockml.bml.transformer.workflow"`,
    ` xmlns:pending="${LIBRARY}._transform.pending"`,
    ` xmlns:type="org.blockml.bml.type">`,
    `  <name>${opts.name}</name>`,
    `  <type>pending:${opts.name}</type>`,
    `  <baseType>workflow:ModelTransformation</baseType>`,
    `  <is>pending execution fixture</is>`,
    refs,
    `  <properties>`,
    `    <executionId override="true">`,
    `      <value>${executionId}</value>`,
    `    </executionId>`,
    `    <status override="true" type="org.blockml.bml.transformer.workflow.ExecutionStatus">`,
    `      <value>Pending</value>`,
    `    </status>`,
    `    <createdAt override="true" type="org.blockml.bml.type.DateTime">`,
    `      <value>2026-08-30T01:17:02</value>`,
    `    </createdAt>`,
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
    ` xmlns:${opts.stage}="${LIBRARY}._transform.${opts.stage}"`,
    ` xmlns:type="org.blockml.bml.type">`,
    `  <name>${opts.name}</name>`,
    `  <type>${opts.stage}:${opts.name}</type>`,
    `  <baseType>workflow:ModelTransformation</baseType>`,
    `  <is>history execution fixture</is>`,
    `  <properties>`,
    `    <executionId override="true"><value>${opts.executionId}</value></executionId>`,
    `    <sequence override="true"><value>${opts.sequence}</value></sequence>`,
    `  </properties>`,
    `  <aggregations>`,
    `    <task override="true">`,
    `      <composition>`,
    `        <workflow:InstructionTask instructions="Already ran." />`,
    `      </composition>`,
    `    </task>`,
    `  </aggregations>`,
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
    ` xmlns:pending="${LIBRARY}._transform.pending"`,
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
