/** BML source span for diagnostics and LSP. */
export interface SourceLocation {
  file: string;
  line: number;
  column: number;
  /** Optional end position for ranges. */
  endLine?: number;
  endColumn?: number;
}

/** Parse metadata for a BomDocument. */
export interface SourceInfo {
  /** Absolute or project-relative path. */
  filePath: string;
  /** "xml" only for authoring. */
  format: "xml";
  /**
   * Authored xmlns prefix → namespace identifier (XML).
   * Default xmlns uses prefix key "".
   */
  namespaceBindings?: Record<string, string>;
  /** Authored xsi:schemaLocation value (opaque string). */
  schemaLocation?: string;
  /** Authored xsi:noNamespaceSchemaLocation when present. */
  noNamespaceSchemaLocation?: string;
}

/**
 * XML comment trivia bound to an element (B11).
 * Bodies only — without `<!--` / `-->`.
 */
export interface XmlTrivia {
  leadingComments?: string[];
  trailingComments?: string[];
}

export type MemberSectionName =
  | "properties"
  | "aggregations"
  | "associations"
  | "capabilities";

/** Key = metadata child element localName. */
export type MetadataElementTrivia = Record<string, XmlTrivia>;

export type XmlNodeKind = "attribute" | "element" | "text";

/** How host-element character data appeared in source when placement is `text` (D8). */
export type CharacterDataForm = "text" | "cdata";

/** Block-level `<bml:xml>` body — lossless. */
export interface XmlRenderingBlock {
  raw: string;
}

/** Member-level `bml:xml` — lossless + emit hints. */
export interface XmlRenderingMember {
  /** Authored `bml:xml` value (e.g. `element|attribute`). */
  raw?: string;
  kinds: XmlNodeKind[];
  authoredPlacement?: XmlNodeKind;
  authoredCharacterDataForm?: CharacterDataForm;
}

export type DiagnosticSeverity = "error" | "warning" | "info";

/** Compiler result diagnostic — distinct from org.blockml.bml.core.Diagnostic BML branch. */
export interface Diagnostic {
  severity: DiagnosticSeverity;
  code: string;
  message: string;
  source: SourceLocation;
}
