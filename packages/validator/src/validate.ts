import type { BomDocument, Diagnostic, ValidateOptions, ValidateResult } from "@blockml/bom";
import { validateStyle } from "./validate-style.js";
import {
  bootstrapTypeRegistry,
  forkBom,
  validateConstraints,
  validateEmbeddedBlocks,
  validateInstances,
  validatePresets,
  validateReadOnly,
  validateTypes,
  validateVersions,
  validateVisibility,
  TypeRegistry,
  type BootstrapResult,
} from "@blockml/framework";

/** Bootstrap scan diagnostics apply to the corpus, not the document under validation. */
function libraryBootstrapDiagnostics(
  bootstrap: BootstrapResult,
  options: ValidateOptions,
): Diagnostic[] {
  if (!options.libraryPaths?.length) {
    return [];
  }
  return bootstrap.diagnostics.filter(
    (d) =>
      d.code === "BML_LIBRARY_RESOLVE_ERROR" ||
      d.code === "BML_LIBRARY_NESTING_VIOLATION",
  );
}

export function validate(
  document: BomDocument,
  options: ValidateOptions = {},
): ValidateResult {
  const continueOnError = options.continueOnError !== false;
  let registry: TypeRegistry;
  let bootstrapDiagnostics: Diagnostic[] = [];

  if (options.typeRegistry instanceof TypeRegistry) {
    registry = options.typeRegistry;
  } else {
    const bootstrapOptions: {
      paths?: string[];
      libraryPaths?: string[];
      rootDir: string;
    } = { rootDir: process.cwd() };
    if (options.bootstrapPaths) {
      bootstrapOptions.paths = options.bootstrapPaths;
    }
    if (options.libraryPaths) {
      bootstrapOptions.libraryPaths = options.libraryPaths;
    }
    const bootstrap = bootstrapTypeRegistry(bootstrapOptions);
    registry = bootstrap.registry;
    bootstrapDiagnostics = libraryBootstrapDiagnostics(bootstrap, options);
  }

  const pragmaticModel = forkBom(document);
  const diagnostics = [
    ...bootstrapDiagnostics,
    ...validateTypes(pragmaticModel, registry),
    ...validateEmbeddedBlocks(pragmaticModel),
    ...validateVersions(pragmaticModel, registry),
    ...validateInstances(pragmaticModel, registry),
    ...validatePresets(pragmaticModel, registry),
    ...validateVisibility(pragmaticModel, registry),
    ...validateReadOnly(pragmaticModel, registry),
    ...validateConstraints(pragmaticModel, registry),
    ...validateStyle(pragmaticModel),
  ];

  const success = !diagnostics.some((d) => d.severity === "error");

  if (!continueOnError && !success) {
    return { diagnostics, success };
  }

  return { pragmaticModel, diagnostics, success };
}
