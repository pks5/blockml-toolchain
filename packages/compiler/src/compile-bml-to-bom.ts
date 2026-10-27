import type { BomDocument, Diagnostic, ParseOptions } from "@blockml/bom";
import { parse } from "@blockml/parser";
import { validate } from "@blockml/validator";
import { evaluateParseValue, normalizeParsedMemberValues, resolveInstanceMemberType, type TypeRegistry } from "@blockml/framework";
import type { CompileInput, CompileOptions, CompilerResult, ValidateRegistryResult } from "./types.js";

export function compileBmlToBom(
  input: CompileInput,
  options: CompileOptions = {},
): CompilerResult<BomDocument> {
  const parseOptions: ParseOptions = { filePath: input.filePath };
  if (options.typeRegistry) {
    const registry = options.typeRegistry;
    parseOptions.parseValue = (fqn, raw) => evaluateParseValue(fqn, raw, registry);
    parseOptions.resolveMemberType = (owner, name) =>
      resolveInstanceMemberType(owner, name, registry);
  }
  const parseResult = parse(input.source, parseOptions);
  const diagnostics: Diagnostic[] = [...parseResult.diagnostics];

  if (!parseResult.document) {
    return {
      output: null,
      diagnostics,
      success: diagnostics.some((d) => d.severity === "error") ? false : !parseResult.success,
    };
  }

  if (options.typeRegistry) {
    normalizeParsedMemberValues(parseResult.document, options.typeRegistry);
  }

  const validateOptions: Parameters<typeof validate>[1] = { continueOnError: true };
  if (options.typeRegistry) {
    validateOptions.typeRegistry = options.typeRegistry;
  }
  const validateResult = validate(parseResult.document, validateOptions);
  diagnostics.push(...validateResult.diagnostics);

  const success = !diagnostics.some((d) => d.severity === "error");
  return {
    output: parseResult.document,
    diagnostics,
    success,
  };
}

export function validateRegistryDocuments(
  registry: TypeRegistry,
  filePaths?: string[],
): ValidateRegistryResult {
  const seen = new Set<string>();
  const diagnostics: Diagnostic[] = [];
  const pathFilter = filePaths !== undefined ? new Set(filePaths) : undefined;
  let blocksWithErrors = 0;

  for (const fqn of registry.keys()) {
    const doc = registry.get(fqn);
    if (!doc) {
      continue;
    }
    const filePath = doc.source?.filePath ?? fqn;
    if (pathFilter && !pathFilter.has(filePath)) {
      continue;
    }
    if (seen.has(filePath)) {
      continue;
    }
    seen.add(filePath);

    const result = validate(doc, {
      typeRegistry: registry,
      continueOnError: true,
    });
    diagnostics.push(...result.diagnostics);
    if (!result.success) {
      blocksWithErrors += 1;
    }
  }

  return {
    diagnostics,
    blocksTested: seen.size,
    blocksWithErrors,
  };
}
