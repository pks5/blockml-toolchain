export const MODEL_TRANSFORMATION_FQN = "org.blockml.bml.transformer.workflow.ModelTransformation";
export const MODEL_OPERATION_FQN = "org.blockml.bml.transformer.workflow.ModelOperation";
export const AGENTIC_OPERATION_FQN = "org.blockml.bml.transformer.workflow.AgenticOperation";
export const EXECUTION_STATUS_FQN = "org.blockml.bml.transformer.workflow.ExecutionStatus";
export const EXECUTION_EXCEPTION_FQN = "org.blockml.bml.transformer.workflow.ExecutionException";
export const RESULT_EXCEPTION_FQN = "org.blockml.bml.transformer.workflow.ResultException";
export const PARAMETERS_EXCEPTION_FQN = "org.blockml.bml.transformer.workflow.ParametersException";
export const PROPERTY_REFERENCE_FQN = "org.blockml.bml.type.PropertyReference";
export const INTEGER_TYPE_FQN = "org.blockml.bml.type.Integer";
export const DATETIME_TYPE_FQN = "org.blockml.bml.type.DateTime";
export const TEXT_TYPE_FQN = "org.blockml.bml.type.Text";
export const UUID_TYPE_FQN = "org.blockml.bml.type.UUID";
export const BOOLEAN_TYPE_FQN = "org.blockml.bml.type.Boolean";
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
];
export const SEQUENCE_STAGES = ["running", "succeeded", "failed"];
//# sourceMappingURL=constants.js.map