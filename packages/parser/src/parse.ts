import type {
  BomDocument,
  Diagnostic,
  ParseOptions,
  ParseResult,
  SourceLocation,
} from "@blockml/bom";
import { detectFormat } from "./pipeline/format-detect.js";
import { documentElement, getParseErrors, parseXmlDom } from "./pipeline/xml-dom.js";
import { assertBlockRoot } from "./pipeline/root-type.js";
import {
  extractNamespaceBindings,
  mergeSourceInfo,
} from "./pipeline/namespaces.js";
import { mapDocumentBlock } from "./map/map-block.js";
import { MappingError } from "./util/mapping-error.js";

function diagnostic(
  code: string,
  message: string,
  filePath: string,
  line = 1,
  column = 1,
  endLine?: number,
  endColumn?: number,
): Diagnostic {
  const source: SourceLocation = { file: filePath, line, column };
  if (endLine !== undefined) {
    source.endLine = endLine;
  }
  if (endColumn !== undefined) {
    source.endColumn = endColumn;
  }
  return {
    severity: "error",
    code,
    message,
    source,
  };
}

function diagnosticAt(code: string, message: string, loc: SourceLocation): Diagnostic {
  return {
    severity: "error",
    code,
    message,
    source: loc,
  };
}

export function parse(source: string, options: ParseOptions = {}): ParseResult {
  const filePath = options.filePath ?? "<memory>";
  const continueOnError = options.continueOnError ?? true;
  const diagnostics: Diagnostic[] = [];

  const format = detectFormat(source);
  if (format !== "xml") {
    diagnostics.push(
      diagnostic("BML_UNSUPPORTED_FORMAT", "Unsupported or undetected format", filePath),
    );
    return { document: null, diagnostics, success: false };
  }

  let doc;
  const parsed = parseXmlDom(source, filePath);
  doc = parsed.document;
  for (const err of parsed.errors) {
    diagnostics.push(
      diagnostic("BML_MALFORMED_XML", err.message, filePath, err.line, err.column),
    );
  }
  if (!doc) {
    return { document: null, diagnostics, success: false };
  }

  const seen = new Set(diagnostics.map((d) => d.message));
  for (const err of getParseErrors(doc)) {
    if (!seen.has(err)) {
      diagnostics.push(diagnostic("BML_MALFORMED_XML", err, filePath));
    }
  }
  if (diagnostics.some((d) => d.code === "BML_MALFORMED_XML") && !continueOnError) {
    return { document: null, diagnostics, success: false };
  }

  const root = documentElement(doc);
  if (!root) {
    diagnostics.push(
      diagnostic("BML_MISSING_ROOT", "No document element", filePath),
    );
    return { document: null, diagnostics, success: false };
  }

  try {
    assertBlockRoot(root);
  } catch (e) {
    diagnostics.push(
      diagnostic(
        "BML_INVALID_ROOT",
        e instanceof Error ? e.message : String(e),
        filePath,
      ),
    );
    return { document: null, diagnostics, success: false };
  }

  const partialSource = extractNamespaceBindings(root);
  const sourceInfo = mergeSourceInfo(partialSource, filePath);
  const bindings = sourceInfo.namespaceBindings ?? {};

  let block;
  try {
    block = mapDocumentBlock(root, filePath, source, bindings, diagnostics);
  } catch (e) {
    if (e instanceof MappingError) {
      diagnostics.push(diagnosticAt(e.code, e.message, e.source));
    } else {
      diagnostics.push(
        diagnostic(
          "BML_MAP_ERROR",
          e instanceof Error ? e.message : String(e),
          filePath,
        ),
      );
    }
    if (!continueOnError) {
      return { document: null, diagnostics, success: false };
    }
    return {
      document: null,
      diagnostics,
      success: diagnostics.every((d) => d.severity !== "error"),
    };
  }

  const document: BomDocument = {
    kind: "block",
    source: sourceInfo,
    block,
  };

  const success = diagnostics.every((d) => d.severity !== "error");
  return { document, diagnostics, success };
}
