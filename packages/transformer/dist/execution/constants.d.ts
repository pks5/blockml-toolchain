export declare const MODEL_TRANSFORMATION_FQN = "org.blockml.bml.transformer.workflow.ModelTransformation";
export declare const STAGE_FQN = "org.blockml.bml.transformer.workflow.Stage";
export declare const EXECUTION_STATUS_FQN = "org.blockml.bml.transformer.workflow.ExecutionStatus";
export declare const EXECUTION_EXCEPTION_FQN = "org.blockml.bml.transformer.workflow.ExecutionException";
export declare const INTEGER_TYPE_FQN = "org.blockml.bml.type.Integer";
export declare const DATETIME_TYPE_FQN = "org.blockml.bml.type.DateTime";
export declare const TEXT_TYPE_FQN = "org.blockml.bml.type.Text";
export declare const FILE_PATH_TYPE_FQN = "org.blockml.bml.type.FilePath";
export declare const FILE_PATH_ENTITY_FQN = "org.blockml.bml.type.FilePathEntity";
export declare const TYPE_PACKAGE_FQN = "org.blockml.bml.type";
/** Library-local metadata package. Created when missing; shared by future extensions. */
export declare const META_SEGMENT = "_meta";
/** Transformer subtree under `_meta`. */
export declare const TRANSFORM_PACKAGE_SEGMENT = "transform";
/** Dotted package path: `_meta.transform`. */
export declare const TRANSFORM_PACKAGE = "_meta.transform";
/** Filesystem path: `_meta/transform`. */
export declare const TRANSFORM_PATH = "_meta/transform";
export declare const LIFECYCLE_STAGES: readonly ["pending", "running", "succeeded", "failed"];
export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];
export declare const SEQUENCE_STAGES: readonly ["running", "succeeded", "failed"];
export type ExecutionStatusId = "Pending" | "Running" | "Failed" | "Succeeded";
export type TerminalExecutionStatus = "Succeeded" | "Failed";
export type TerminalLifecycleStage = "succeeded" | "failed";
//# sourceMappingURL=constants.d.ts.map