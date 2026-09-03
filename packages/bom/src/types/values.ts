import type { SourceLocation } from "./common.js";

export type MemberValue =
  | LiteralValue
  | ExpressionValue
  | InterpolatedTextValue
  | AddressValue;

export interface LiteralValue {
  kind: "literal";
  /**
   * Authored value exactly as in BML — preserved for lossless round-trip.
   * MUST NOT be normalized at parse/validate time.
   */
  value: unknown;
  typeFqn: string;
  /** Which form this value used in source when element|attribute dual placement is legal (D9). */
  authoredPlacement?: "attribute" | "element";
}

export interface ExpressionValue {
  kind: "expression";
  /** Raw source inside ${ } — the only expression field in Canonical BOM. */
  raw: string;
  /** Which form carried this expression when element|attribute dual placement is legal (D9). */
  authoredPlacement?: "attribute" | "element";
  source?: SourceLocation;
}

export interface InterpolatedTextValue {
  kind: "interpolated";
  /** Full authored text including ${} holes — the only interpolation field in Canonical BOM. */
  raw: string;
  /** Which form carried this text when element|attribute dual placement is legal (D9). */
  authoredPlacement?: "attribute" | "element";
  source?: SourceLocation;
}

export interface AddressValue {
  kind: "address";
  /** Parsed org.blockml.bml.type.Address. */
  address: Address;
}

export interface Address {
  raw: string;
  scheme: string | null;
  path: string;
  isAbsolute: boolean;
  isRelative: boolean;
  isExpression: boolean;
}
