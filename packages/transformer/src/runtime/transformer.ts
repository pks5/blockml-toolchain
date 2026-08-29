import type { TransformationAgent } from "../agent/transformation-agent.js";
import { TransformError } from "../execution/errors.js";
import { completeExecution } from "../execution/complete.js";
import { resolvePendingExecution } from "../execution/resolve.js";
import { startExecution, type StartedExecution } from "../execution/start.js";

export interface TransformerOptions {
  workspaceRoot: string;
  agent: TransformationAgent;
  now?: () => Date;
}

export interface TransformRunResult {
  success: true;
  pendingFqn: string;
  runningFqn: string;
  completedFqn: string;
  sequence: number;
  executionId: string | undefined;
}

export class Transformer {
  private readonly workspaceRoot: string;
  private readonly agent: TransformationAgent;
  private readonly now: () => Date;

  constructor(options: TransformerOptions) {
    this.workspaceRoot = options.workspaceRoot;
    this.agent = options.agent;
    this.now = options.now ?? (() => new Date());
  }

  async run(executionFqn: string): Promise<TransformRunResult> {
    const resolved = resolvePendingExecution(executionFqn, this.workspaceRoot);
    const started = startExecution(resolved, this.now());
    const agentResult = await this.agent.execute({
      workspaceRoot: this.workspaceRoot,
      executionFqn: started.runningFqn,
    });
    if (!agentResult.success) {
      throw new TransformError(
        "execution",
        agentResult.error || "Transformation agent failed",
      );
    }
    const completed = completeExecution(this.workspaceRoot, started, this.now());
    return {
      success: true,
      pendingFqn: executionFqn,
      runningFqn: started.runningFqn,
      completedFqn: completed.completedFqn,
      sequence: started.sequence,
      executionId: started.executionId,
    };
  }
}

export interface RunTransformationOptions {
  workspaceRoot: string;
  executionFqn: string;
  agent: TransformationAgent;
  now?: () => Date;
}

export type RunTransformationResult =
  | (TransformRunResult & { exitCode: 0 })
  | { success: false; exitCode: number; error: string };

export async function runTransformation(
  options: RunTransformationOptions,
): Promise<RunTransformationResult> {
  const transformerOptions: TransformerOptions = {
    workspaceRoot: options.workspaceRoot,
    agent: options.agent,
  };
  if (options.now) {
    transformerOptions.now = options.now;
  }
  const transformer = new Transformer(transformerOptions);
  try {
    const result = await transformer.run(options.executionFqn);
    return { ...result, exitCode: 0 };
  } catch (error) {
    if (error instanceof TransformError) {
      return {
        success: false,
        exitCode: error.exitCode,
        error: error.message,
      };
    }
    return {
      success: false,
      exitCode: 2,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export type { StartedExecution };
