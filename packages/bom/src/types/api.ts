import type { BomDocument } from "./document.js";
import type { Diagnostic } from "./common.js";

export interface ParseResult {
  /** null only on hard fail (format / malformed XML / no usable root). */
  document: BomDocument | null;
  diagnostics: Diagnostic[];
  /** false if any diagnostic has severity === "error". */
  success: boolean;
}

export interface SerializeResult {
  /** null only if serialize cannot produce text. */
  text: string | null;
  diagnostics: Diagnostic[];
  success: boolean;
}

export interface ParseOptions {
  /** default: "<memory>" — written to BomDocument.source.filePath */
  filePath?: string;
  /** default true — keep mapping after errors; attach document when possible */
  continueOnError?: boolean;
}

export interface SerializeOptions {
  /** default 2 — pretty-print spaces (B13); 0 = compact */
  indent?: number;
  /** default false — omit <?xml …?> (B17 / B24) */
  xmlDeclaration?: boolean;
}
