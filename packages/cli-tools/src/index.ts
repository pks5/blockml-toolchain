export { loadConfig, type BomConfig } from "./load-config.js";
export { bootstrapTargets, resetBootstrapTargets } from "./bootstrap-targets.js";
export { bootstrapProjectTypeRegistry } from "./bootstrap-type-registry.js";
export { writeOutputFiles, type WriteOutputOptions } from "./write-output.js";
export { parseArgs, runCli, formatDiagnostic, type ParsedArgs } from "./cli.js";
export {
  collectRegistryFilePaths,
  parseCatalogUriEntries,
  resolveBmlSchemaPath,
  validateFilesAgainstXsd,
} from "./xsd-validate.js";
