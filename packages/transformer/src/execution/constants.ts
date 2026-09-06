export const MODEL_TRANSFORMATION_FQN =
  "org.blockml.bml.transformer.workflow.ModelTransformation";
export const MODEL_OPERATION_FQN =
  "org.blockml.bml.transformer.workflow.ModelOperation";
export const AGENTIC_OPERATION_FQN =
  "org.blockml.bml.transformer.workflow.AgenticOperation";
export const TOOL_OPERATION_FQN =
  "org.blockml.bml.transformer.workflow.ToolOperation";
export const EXECUTION_STATUS_FQN =
  "org.blockml.bml.transformer.workflow.ExecutionStatus";
export const EXECUTION_EXCEPTION_FQN =
  "org.blockml.bml.transformer.workflow.ExecutionException";
export const RESULT_EXCEPTION_FQN =
  "org.blockml.bml.transformer.workflow.ResultException";
export const RESULT_MAPPING_FQN =
  "org.blockml.bml.transformer.workflow.ResultMapping";
export const PARAMETER_MAPPING_FQN =
  "org.blockml.bml.transformer.workflow.ParameterMapping";
export const PARAMETERS_EXCEPTION_FQN =
  "org.blockml.bml.transformer.workflow.ParametersException";
export const PROPERTY_REFERENCE_FQN = "org.blockml.bml.type.PropertyReference";
export const PROPERTY_IDENTIFIER_FQN = "org.blockml.bml.type.PropertyIdentifier";

export const INTEGER_TYPE_FQN = "org.blockml.bml.type.Integer";
export const DATETIME_TYPE_FQN = "org.blockml.bml.type.DateTime";
export const TEXT_TYPE_FQN = "org.blockml.bml.type.Text";
export const UUID_TYPE_FQN = "org.blockml.bml.type.UUID";
export const BOOLEAN_TYPE_FQN = "org.blockml.bml.type.Boolean";
export const EMPTY_STRUCT_FQN = "org.blockml.bml.type.EmptyStruct";
export const STRUCT_TYPE_FQN = "org.blockml.bml.type.StructType";
export const NUMBER_TYPE_FQN = "org.blockml.bml.type.Number";

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export const FILE_PATH_TYPE_FQN = "org.blockml.bml.type.FilePath";
export const FILE_PATH_ENTITY_FQN = "org.blockml.bml.type.FilePathEntity";
export const TYPE_PACKAGE_FQN = "org.blockml.bml.type";

/** Library-local metadata package. Created when missing; shared by future extensions. */
export const META_SEGMENT = "_meta";
/** Transformer subtree under `_meta`. */
export const TRANSFORM_PACKAGE_SEGMENT = "transform";
/** Dotted package path: `_meta.transform`. */
export const TRANSFORM_PACKAGE = `${META_SEGMENT}.${TRANSFORM_PACKAGE_SEGMENT}`;
/** Filesystem path: `_meta/transform`. */
export const TRANSFORM_PATH = `${META_SEGMENT}/${TRANSFORM_PACKAGE_SEGMENT}`;

export const LIFECYCLE_STAGES = [
  "pending",
  "running",
  "succeeded",
  "failed",
] as const;
export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

/** Template catalog under `_meta.transform`. Not a lifecycle status. */
export const AVAILABLE_SEGMENT = "available";
/** Prefixes/URIs Apply copies may carry and must strip on relocate. */
export const TRANSFORM_NS_SEGMENTS = [
  ...LIFECYCLE_STAGES,
  AVAILABLE_SEGMENT,
] as const;

export const SEQUENCE_STAGES = ["running", "succeeded", "failed"] as const;

export type ExecutionStatusId = "Pending" | "Running" | "Failed" | "Succeeded";
export type TerminalExecutionStatus = "Succeeded" | "Failed";
export type TerminalLifecycleStage = "succeeded" | "failed";
