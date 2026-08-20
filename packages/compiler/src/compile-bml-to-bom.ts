import type { BomDocument, Diagnostic } from "@blockml/bom";
import { parse } from "@blockml/parser";
import { validate } from "@blockml/validator";
import type { TypeRegistry } from "@blockml/framework";
import type { CompileInput, CompileOptions, CompilerResult } from "./types.js";

export function compileBmlToBom(
  input: CompileInput,
  options: CompileOptions = {},
): CompilerResult<BomDocument> {
  const parseResult = parse(input.source, { filePath: input.filePath });
  const diagnostics: Diagnostic[] = [...parseResult.diagnostics];

  if (!parseResult.document) {
    return {
      output: null,
      diagnostics,
      success: diagnostics.some((d) => d.severity === "error") ? false : !parseResult.success,
    };
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
): Diagnostic[] {
  const seen = new Set<string>();
  const diagnostics: Diagnostic[] = [];

  for (const fqn of registry.keys()) {
    const doc = registry.get(fqn);
    if (!doc) {
      continue;
    }
    const filePath = doc.source?.filePath ?? fqn;
    if (seen.has(filePath)) {
      continue;
    }
    seen.add(filePath);

    const result = validate(doc, {
      typeRegistry: registry,
      continueOnError: true,
    });
    diagnostics.push(...result.diagnostics);
  }

  return diagnostics;
}
