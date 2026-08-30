import type { TransformationAgent } from "../agent/transformation-agent.js";
import type { ReflectionAgent } from "../agent/reflection-agent.js";
import { TransformError } from "../execution/errors.js";
import { createDefaultPipeline } from "../pipeline/default-pipeline.js";
import type {
  StageContext,
  TransformPipeline,
  TransformRunResult,
} from "../pipeline/types.js";
import { acquireWorktreeLock } from "./worktree-lock.js";

export type { TransformRunResult };

export interface TransformerOptions {
  workspaceRoot: string;
  agent?: TransformationAgent;
  reflectAgent?: ReflectionAgent;
  pipeline?: Partial<TransformPipeline>;
  now?: () => Date;
}

export class Transformer {
  private readonly workspaceRoot: string;
  private readonly pipeline: TransformPipeline;
  private readonly now: () => Date;

  constructor(options: TransformerOptions) {
    this.workspaceRoot = options.workspaceRoot;
    this.pipeline = resolvePipeline(options);
    this.now = options.now ?? (() => new Date());
  }

  async run(executionFqn: string): Promise<TransformRunResult> {
    const lock = await acquireWorktreeLock(this.workspaceRoot, executionFqn);
    const context: StageContext = {
      workspaceRoot: this.workspaceRoot,
      now: this.now,
    };
    try {
      const prepared = await this.pipeline.prepare.run(executionFqn, context);
      const executed = await this.pipeline.execute.run(prepared, context);
      const reflected = await this.pipeline.reflect.run(executed, context);
      const persisted = await this.pipeline.persist.run(reflected, context);
      return await this.pipeline.finalize.run(persisted, context);
    } finally {
      await lock.release();
    }
  }
}

export interface RunTransformationOptions {
  workspaceRoot: string;
  executionFqn: string;
  agent?: TransformationAgent;
  reflectAgent?: ReflectionAgent;
  pipeline?: Partial<TransformPipeline>;
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
  };
  if (options.agent) {
    transformerOptions.agent = options.agent;
  }
  if (options.reflectAgent) {
    transformerOptions.reflectAgent = options.reflectAgent;
  }
  if (options.pipeline) {
    transformerOptions.pipeline = options.pipeline;
  }
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

function resolvePipeline(options: TransformerOptions): TransformPipeline {
  if (options.agent) {
    return {
      ...createDefaultPipeline(options.agent, options.reflectAgent),
      ...options.pipeline,
    };
  }
  const pipeline = options.pipeline;
  if (
    pipeline?.prepare &&
    pipeline.execute &&
    pipeline.reflect &&
    pipeline.persist &&
    pipeline.finalize
  ) {
    return {
      prepare: pipeline.prepare,
      execute: pipeline.execute,
      reflect: pipeline.reflect,
      persist: pipeline.persist,
      finalize: pipeline.finalize,
    };
  }
  throw new TransformError(
    "resolve",
    "Transformer requires an agent or a complete pipeline",
  );
}

export type { StartedExecution } from "../execution/start.js";
