export { loadConfig } from "./load-config.js";
export { bootstrapTargets, builtinTargetNames, getTargetCliHints, getTargetFactory, registerTargetFactory, resetBootstrapTargets, } from "./bootstrap-targets.js";
export { bootstrapProjectTypeRegistry } from "./bootstrap-type-registry.js";
export { writeOutputFiles } from "./write-output.js";
export { parseArgs, runCli, formatDiagnostic } from "./cli.js";
export { collectRegistryFilePaths, parseCatalogUriEntries, resolveBmlSchemaPath, validateFilesAgainstXsd, } from "./xsd-validate.js";
export { isBuiltinTarget, loadTargetFromPackage, resolveTargetPackage, } from "./load-target-plugin.js";
//# sourceMappingURL=index.js.map