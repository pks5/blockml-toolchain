export {
  inspectBlock,
  inspectProject,
  isLeafTypeFqn,
} from "./inspect.js";
export {
  DEFAULT_INSPECT_DEPTH,
  DEFAULT_MAX_BLOCKS,
  DOC_TRUNCATE,
  MAX_INSPECT_DEPTH,
  REF_TRUNCATE,
  TYPE_PACKAGE_PREFIX,
  VALUE_TYPE_FQN,
} from "./types.js";
export type {
  InspectBlockOptions,
  InspectedBlock,
  InspectedGenericType,
  InspectedImplementation,
  InspectedInstance,
  InspectedMember,
  InspectedReference,
  InspectOrigin,
  InspectProjectOptions,
  InspectResult,
  InspectStructField,
  InspectTypeKind,
  InspectTypeRef,
} from "./types.js";
export { collectNamedFqns, multiplicityLabel, projectTypeExpression } from "./type-refs.js";
