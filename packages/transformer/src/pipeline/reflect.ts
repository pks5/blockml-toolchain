import type { ReflectionAgent } from "../agent/reflection-agent.js";
import { TransformError } from "../execution/errors.js";
import { loadRunningExecution } from "../execution/load-running.js";
import {
  getStageInstance,
  getStagePropertyLiteral,
} from "../execution/properties.js";
import type { StartedExecution } from "../execution/start.js";
import type {
  ExecutedWork,
  Reflection,
  StageContext,
  TransformStage,
} from "./types.js";

export function createReflectStage(): TransformStage<ExecutedWork, Reflection> {
  return {
    async run(executed: ExecutedWork, context: StageContext): Promise<Reflection> {
      const output = stageCapturesOutput(
        context.workspaceRoot,
        executed.started,
        executed.stageIndex,
      )
        ? agentOutput(executed.trace.stdout)
        : undefined;
      return {
        ...executed,
        changedFiles: executed.trace.changedFiles,
        output,
        outcome: "succeeded",
      };
    },
  };
}

export function createNoopReflectStage(): TransformStage<ExecutedWork, Reflection> {
  return createReflectStage();
}

export function createAgentReflectStage(
  agent: ReflectionAgent,
): TransformStage<ExecutedWork, Reflection> {
  return {
    async run(executed: ExecutedWork, context: StageContext): Promise<Reflection> {
      const result = await agent.reflect({
        workspaceRoot: context.workspaceRoot,
        executionFqn: executed.started.runningFqn,
        stageIndex: executed.stageIndex,
        trace: executed.trace,
      });
      if (!result.success) {
        throw new TransformError(
          "execution",
          result.error || "Reflection agent failed",
        );
      }
      const changedFiles =
        result.changedFiles.length > 0
          ? result.changedFiles
          : executed.trace.changedFiles;
      return {
        ...executed,
        changedFiles,
        output: result.output,
        outcome: "succeeded",
      };
    },
  };
}

function stageCapturesOutput(
  workspaceRoot: string,
  started: StartedExecution,
  stageIndex: number,
): boolean {
  const { document } = loadRunningExecution(workspaceRoot, started);
  const stage = getStageInstance(document.block, stageIndex);
  if (!stage) {
    return false;
  }
  const value = getStagePropertyLiteral(stage, "captureOutput");
  if (value === true) {
    return true;
  }
  return typeof value === "string" && value.toLowerCase() === "true";
}

function agentOutput(stdout: string): string | undefined {
  return stdout.length > 0 ? stdout : undefined;
}
