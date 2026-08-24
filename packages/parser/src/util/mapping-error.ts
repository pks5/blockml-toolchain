import type { SourceLocation } from "@blockml/bom";
import {
  attributeValueLoc,
  elementSourceLoc,
  locateNeedleNearElement,
} from "./qname.js";

export class MappingError extends Error {
  readonly code: string;
  readonly source: SourceLocation;

  constructor(code: string, message: string, source: SourceLocation) {
    super(message);
    this.name = "MappingError";
    this.code = code;
    this.source = source;
  }
}

export interface AttrHint {
  name: string;
  value: string;
}

const CODE_PREFIX = /^(BML_[A-Z0-9_]+)(?::\s*(.*))?$/s;

function mappingErrorFromUnknown(
  err: unknown,
  source: SourceLocation,
): MappingError {
  if (err instanceof MappingError) {
    return err;
  }
  const message = err instanceof Error ? err.message : String(err);
  const match = message.match(CODE_PREFIX);
  const code = match?.[1] ?? "BML_MAP_ERROR";
  return new MappingError(code, message, source);
}

function needleFromMessage(message: string): string | undefined {
  const match = message.match(CODE_PREFIX);
  const rest = match?.[2]?.trim();
  if (!rest || rest === "empty") {
    return undefined;
  }
  return rest;
}

function refineToNeedle(
  loc: SourceLocation,
  source: string,
  needle: string,
): SourceLocation {
  const start = lineColumnToOffset(source, loc.line, loc.column);
  const end =
    loc.endLine !== undefined
      ? lineColumnToOffset(source, loc.endLine, loc.endColumn ?? 1)
      : Math.min(start + 256, source.length);
  const slice = source.slice(start, end);
  const withColon = `${needle}:`;
  let idx = slice.indexOf(withColon);
  let len = withColon.length;
  if (idx === -1) {
    idx = slice.indexOf(needle);
    len = needle.length;
  }
  if (idx === -1) {
    return loc;
  }
  const abs = start + idx;
  const s = offsetToLineCol(source, abs);
  const e = offsetToLineCol(source, abs + len);
  return {
    file: loc.file,
    line: s.line,
    column: s.column,
    endLine: e.line,
    endColumn: e.column,
  };
}

function offsetToLineCol(source: string, offset: number): { line: number; column: number } {
  const clamped = Math.max(0, Math.min(offset, source.length));
  const before = source.slice(0, clamped);
  const line = before.split("\n").length;
  const lastNl = before.lastIndexOf("\n");
  const column = clamped - lastNl;
  return { line, column };
}

function lineColumnToOffset(source: string, line: number, column: number): number {
  let remaining = line - 1;
  let offset = 0;
  while (remaining > 0) {
    const nl = source.indexOf("\n", offset);
    if (nl === -1) {
      return source.length;
    }
    offset = nl + 1;
    remaining--;
  }
  return Math.min(offset + Math.max(0, column - 1), source.length);
}

function locateMappingError(
  file: string,
  source: string,
  element: { nodeName: string; lineNumber?: number; columnNumber?: number },
  err: unknown,
  attr?: AttrHint,
): SourceLocation {
  const message = err instanceof Error ? err.message : String(err);
  const needle = needleFromMessage(message);

  if (attr) {
    let loc = attributeValueLoc(file, source, element, attr.name, attr.value);
    if (loc) {
      if (needle) {
        loc = refineToNeedle(loc, source, needle);
      }
      return loc;
    }
  }

  if (needle) {
    const near = locateNeedleNearElement(file, source, element, needle);
    if (near) {
      return near;
    }
  }

  return elementSourceLoc(file, source, element);
}

function withElementLocation<T>(
  file: string,
  source: string,
  element: { nodeName: string; lineNumber?: number; columnNumber?: number },
  fn: () => T,
  attr?: AttrHint,
): T {
  try {
    return fn();
  } catch (err) {
    if (err instanceof MappingError) {
      throw err;
    }
    throw mappingErrorFromUnknown(err, locateMappingError(file, source, element, err, attr));
  }
}

export { withElementLocation };
