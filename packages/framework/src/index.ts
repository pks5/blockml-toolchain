export { TypeRegistry } from "./registry/type-registry.js";
export {
  bootstrapTypeRegistry,
  bootstrapFullProjectRegistry,
  defaultBootstrapPaths,
  resolveLibrarySeeds,
  type BootstrapResult,
  type BootstrapOptions,
  type BootstrapTrace,
} from "./registry/bootstrap.js";
export {
  projectSourceRoots,
  projectLibraryPackageRoots,
  projectLibraryPackageDirs,
  registryFilesUnderRoots,
} from "./registry/project-sources.js";
export { rootFqnByFilePath, rootFqns } from "./registry/root-fqn.js";
export { getExportedFqns } from "./registry/library-exports.js";
export { peekLibraryTypeFqn } from "./registry/library-bootstrap.js";
export { forkBom } from "./fork/fork-bom.js";
export {
  resolveEffectiveMembers,
  resolveContracts,
  collectBaseTypeChain,
  memberIdentityKey,
  findLocalMember,
} from "./resolve/resolve-effective-members.js";
export { parseExpression } from "./expression/parse-expression.js";
export type {
  ExpressionNode,
  ParseExpressionResult,
  ParseExpressionOutcome,
} from "./expression/types.js";
export {
  validateTypes,
  getPropertyNumericValue,
  isLiteralValue,
} from "./validate/validate-types.js";
export { validateVersions } from "./validate/validate-versions.js";
export { validateConstraints } from "./validate/validate-constraints.js";
export { validateEmbeddedBlocks } from "./validate/validate-embedded-blocks.js";
export { validateInstances } from "./validate/validate-instances.js";
export { validateGenerics } from "./validate/validate-generics.js";
export { validatePresets } from "./validate/validate-presets.js";
export { validateVisibility } from "./validate/validate-visibility.js";
export { validateReadOnly } from "./validate/validate-readonly.js";
