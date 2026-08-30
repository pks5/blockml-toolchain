import {
  ClaudeCodeAgent,
  ClaudeReflectAgent,
  runTransformation,
  type ReflectionAgent,
  type TransformationAgent,
} from "@blockml/transformer";
import { pushLines, type CliOutputLine } from "./cli-style.js";

export async function runTransform(
  executionFqn: string | undefined,
  rootDir: string,
  lines: CliOutputLine[],
  usage: string,
  agent: TransformationAgent,
  reflectAgent?: ReflectionAgent,
): Promise<number> {
  const fqn = executionFqn?.trim() ?? "";
  if (!fqn) {
    pushLines(lines, "Specify a TaskExecution FQN.", "error");
    pushLines(lines, usage, "info");
    return 2;
  }

  const result = await runTransformation({
    workspaceRoot: rootDir,
    executionFqn: fqn,
    agent,
    ...(reflectAgent ? { reflectAgent } : {}),
  });

  if (!result.success) {
    pushLines(lines, result.error, "error");
    if (result.terminalFqn) {
      pushLines(lines, result.terminalFqn, "error");
    }
    return result.exitCode;
  }

  pushLines(lines, `Transformed ${result.terminalFqn}`, "success");
  return 0;
}

export function defaultTransformAgent(verbose = false): TransformationAgent {
  if (verbose) {
    return new ClaudeCodeAgent({ verbose: true });
  }
  return new ClaudeCodeAgent();
}

export function defaultReflectAgent(verbose = false): ReflectionAgent {
  if (verbose) {
    return new ClaudeReflectAgent({ verbose: true });
  }
  return new ClaudeReflectAgent();
}
