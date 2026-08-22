import type { BomDocument, Diagnostic } from "@blockml/bom";
import { parse } from "@blockml/parser";
import { serialize } from "@blockml/serializer";
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

export interface FormatDocumentOptions {
  indent?: number;
  xmlDeclaration?: boolean;
}

function hasXmlDeclaration(text: string): boolean {
  return /^\s*<\?xml\b/.test(text);
}

export function formatDocument(
  text: string,
  options: FormatDocumentOptions = {},
): string | null {
  const parseResult = parse(text, { continueOnError: true });
  if (!parseResult.document) {
    return null;
  }

  const serializeOptions: {
    indent?: number;
    xmlDeclaration?: boolean;
  } = {
    xmlDeclaration: options.xmlDeclaration ?? hasXmlDeclaration(text),
  };
  if (options.indent !== undefined) {
    serializeOptions.indent = options.indent;
  }

  const result = serialize(parseResult.document, serializeOptions);
  return result.text;
}
