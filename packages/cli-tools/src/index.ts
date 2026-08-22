export { loadConfig, type BomConfig } from "./load-config.js";
export {
  bootstrapTargets,
  builtinTargetNames,
  getTargetCliHints,
  getTargetFactory,
  registerTargetFactory,
  resetBootstrapTargets,
  type TargetCliHints,
} from "./bootstrap-targets.js";
export { bootstrapProjectTypeRegistry } from "./bootstrap-type-registry.js";
export { writeOutputFiles, type WriteOutputOptions, type WriteOutputResult } from "./write-output.js";
export { parseArgs, runCli, formatDiagnostic, type ParsedArgs } from "./cli.js";
export {
  collectRegistryFilePaths,
  parseCatalogUriEntries,
  resolveBmlSchemaPath,
  validateFilesAgainstXsd,
} from "./xsd-validate.js";
export {
  isBuiltinTarget,
  loadTargetFromPackage,
  resolveTargetPackage,
} from "./load-target-plugin.js";
