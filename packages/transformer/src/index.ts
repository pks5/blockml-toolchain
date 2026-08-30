export { Transformer, runTransformation } from "./runtime/transformer.js";
export type {
  TransformerOptions,
  TransformRunResult,
  RunTransformationOptions,
  RunTransformationResult,
} from "./runtime/transformer.js";

export { createDefaultPipeline } from "./pipeline/default-pipeline.js";
export { createPrepareStage } from "./pipeline/prepare.js";
export { createExecuteStage } from "./pipeline/execute.js";
export { createNoopReflectStage, createReflectStage } from "./pipeline/reflect.js";
export { createNoopPersistStage, createPersistStage } from "./pipeline/persist.js";
export { createFinalizeStage } from "./pipeline/finalize.js";
export { collectWorktreeTrace } from "./pipeline/worktree-trace.js";
export type { WorktreeTrace } from "./pipeline/worktree-trace.js";
export type {
  StageContext,
  TransformStage,
  TransformPipeline,
  PreparedExecution,
  ExecutionTrace,
  ExecutedWork,
  Reflection,
  PersistedExecution,
} from "./pipeline/types.js";

export type {
  TransformationAgent,
  AgentExecutionRequest,
  AgentExecutionResult,
} from "./agent/transformation-agent.js";
export type {
  ReflectionAgent,
  ReflectRequest,
  ReflectResult,
} from "./agent/reflection-agent.js";
export {
  ClaudeCodeAgent,
  buildClaudeExecutionPrompt,
  ensureAgentsMarkdown,
  runClaudeProcess,
} from "./agent/claude-code-agent.js";
export {
  ClaudeReflectAgent,
  buildClaudeReflectPrompt,
  parseReflectionOutput,
} from "./agent/claude-reflect-agent.js";
export type { ClaudeReflectAgentOptions } from "./agent/claude-reflect-agent.js";
export {
  CLAUDE_EXECUTE_PERMISSIONS,
  CLAUDE_REFLECT_PERMISSIONS,
  CLAUDE_TRANSFORM_PERMISSIONS,
  claudePermissionCliArgs,
} from "./agent/claude-permissions.js";
export type {
  ClaudePermissionMode,
  ClaudeTransformPermissions,
} from "./agent/claude-permissions.js";
export {
  ClaudeLiveFormatter,
  formatClaudeStreamLine,
} from "./agent/claude-stream.js";
export type {
  ClaudeCodeAgentOptions,
  ClaudeProcessRequest,
  ClaudeProcessResult,
  ClaudeProcessRunner,
} from "./agent/claude-code-agent.js";

export { TransformError } from "./execution/errors.js";
export type { TransformFailureKind } from "./execution/errors.js";
export {
  acquireWorktreeLock,
  transformLockPath,
  TRANSFORM_LOCK_STALE_MS,
} from "./runtime/worktree-lock.js";
export { resolvePendingExecution } from "./execution/resolve.js";
export { startExecution } from "./execution/start.js";
export { persistReflection } from "./execution/persist.js";
export { completeExecution } from "./execution/complete.js";
export { SequenceAllocator } from "./execution/sequence.js";
export {
  parseExecutionFqn,
  generateExecutionName,
  padSequence,
  formatNameTimestamp,
  formatDateTimeProperty,
} from "./execution/lifecycle.js";
export { TASK_EXECUTION_FQN } from "./execution/constants.js";
