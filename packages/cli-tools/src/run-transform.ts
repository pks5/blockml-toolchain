import {
  ClaudeCodeAgent,
  ClaudeReflectAgent,
  formatTransformLifecycle,
  runTransformation,
  type ReflectionAgent,
  type TransformationAgent,
  type TransformLifecycleEvent,
} from "@blockml/transformer";
import {
  pushLines,
  type CliOutputLine,
  type CliStreamKind,
} from "./cli-style.js";

export async function runTransform(
  executionFqn: string | undefined,
  rootDir: string,
  lines: CliOutputLine[],
  usage: string,
  agent: TransformationAgent,
  reflectAgent?: ReflectionAgent,
  onOutputLine?: (line: CliOutputLine) => void,
): Promise<number> {
  const fqn = executionFqn?.trim() ?? "";
  if (!fqn) {
    emit(lines, onOutputLine, "Specify a ModelTransformation FQN.", "error");
    emit(lines, onOutputLine, usage, "info");
    return 2;
  }

  const result = await runTransformation({
    workspaceRoot: rootDir,
    executionFqn: fqn,
    agent,
    ...(reflectAgent ? { reflectAgent } : {}),
    onLifecycle: (event) => {
      const line = lifecycleOutput(event);
      if (line) {
        emit(lines, onOutputLine, line.text, line.kind);
      }
    },
  });

  if (!result.success) {
    emit(lines, onOutputLine, result.error, "error");
    if (result.terminalFqn) {
      emit(lines, onOutputLine, result.terminalFqn, "error");
    }
    return result.exitCode;
  }

  return 0;
}

function lifecycleOutput(
  event: TransformLifecycleEvent,
): CliOutputLine | undefined {
  if (event.kind === "transformationComplete" && event.status !== "Succeeded") {
    return undefined;
  }
  const text = formatTransformLifecycle(event);
  return { kind: lifecycleKind(event), text };
}

function lifecycleKind(event: TransformLifecycleEvent): CliStreamKind {
  if (event.kind === "transformationComplete") {
    return "success";
  }
  if (event.kind === "transformationStatus" || event.kind === "stageStatus") {
    if (event.status === "Succeeded") {
      return "success";
    }
    if (event.status === "Failed") {
      return "error";
    }
  }
  return "info";
}

function emit(
  lines: CliOutputLine[],
  onOutputLine: ((line: CliOutputLine) => void) | undefined,
  text: string,
  kind: CliStreamKind,
): void {
  const before = lines.length;
  pushLines(lines, text, kind);
  if (!onOutputLine) {
    return;
  }
  for (const line of lines.slice(before)) {
    onOutputLine(line);
  }
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
