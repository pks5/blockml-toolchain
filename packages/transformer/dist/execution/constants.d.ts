export declare const TASK_EXECUTION_FQN = "org.blockml.bml.transformer.workflow.TaskExecution";
export declare const EXECUTION_STATUS_FQN = "org.blockml.bml.transformer.workflow.ExecutionStatus";
export declare const EXECUTION_EXCEPTION_FQN = "org.blockml.bml.transformer.workflow.ExecutionException";
export declare const INTEGER_TYPE_FQN = "org.blockml.bml.type.Integer";
export declare const DATETIME_TYPE_FQN = "org.blockml.bml.type.DateTime";
export declare const TEXT_TYPE_FQN = "org.blockml.bml.type.Text";
export declare const TRANSFORM_SEGMENT = "_transform";
export declare const LIFECYCLE_STAGES: readonly ["pending", "running", "succeeded", "failed"];
export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];
export declare const SEQUENCE_STAGES: readonly ["running", "succeeded", "failed"];
export type ExecutionStatusId = "Pending" | "Running" | "Failed" | "Succeeded";
export type TerminalExecutionStatus = "Succeeded" | "Failed";
export type TerminalLifecycleStage = "succeeded" | "failed";
//# sourceMappingURL=constants.d.ts.map