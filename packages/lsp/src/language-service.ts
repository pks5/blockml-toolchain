import type { BomDocument, Diagnostic } from "@blockml/bom";
import { parse } from "@blockml/parser";
import { validate } from "@blockml/validator";
import type { WorkspaceState } from "./workspace.js";

export interface AnalysisResult {
  diagnostics: Diagnostic[];
  document: BomDocument | null;
}

export function analyzeDocument(
  text: string,
  filePath: string,
  workspace: WorkspaceState,
): AnalysisResult {
  const parseResult = parse(text, { filePath, continueOnError: true });
  const diagnostics: Diagnostic[] = [...parseResult.diagnostics];

  if (!parseResult.document) {
    return { diagnostics, document: null };
  }

  const validateResult = validate(parseResult.document, {
    typeRegistry: workspace.registry,
    continueOnError: true,
  });
  diagnostics.push(...validateResult.diagnostics);

  return {
    diagnostics,
    document: parseResult.document,
  };
}
