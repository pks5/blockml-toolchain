export const MODEL_TRANSFORMATION_FQN =
  "org.blockml.bml.transformer.workflow.ModelTransformation";
export const EXECUTION_STATUS_FQN =
  "org.blockml.bml.transformer.workflow.ExecutionStatus";
export const EXECUTION_EXCEPTION_FQN =
  "org.blockml.bml.transformer.workflow.ExecutionException";

export const INTEGER_TYPE_FQN = "org.blockml.bml.type.Integer";
export const DATETIME_TYPE_FQN = "org.blockml.bml.type.DateTime";
export const TEXT_TYPE_FQN = "org.blockml.bml.type.Text";
export const FILE_PATH_TYPE_FQN = "org.blockml.bml.type.FilePath";
export const FILE_PATH_ENTITY_FQN = "org.blockml.bml.type.FilePathEntity";
export const TYPE_PACKAGE_FQN = "org.blockml.bml.type";

export const TRANSFORM_SEGMENT = "_transform";

export const LIFECYCLE_STAGES = [
  "pending",
  "running",
  "succeeded",
  "failed",
] as const;
export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

export const SEQUENCE_STAGES = ["running", "succeeded", "failed"] as const;

export type ExecutionStatusId = "Pending" | "Running" | "Failed" | "Succeeded";
export type TerminalExecutionStatus = "Succeeded" | "Failed";
export type TerminalLifecycleStage = "succeeded" | "failed";
