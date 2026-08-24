import type { LiteralValue, ExpressionValue } from "./values.js";

/** Parse-time type expression — not a language ValueType. */
export type TypeExpression =
  | NamedTypeReference
  | AnonymousStructType
  | UnionTypeExpression
  | GroupedTypeExpression
  | GenericParameterReference
  | SelfTypeReference;

/** V1 alias kept for Capability inputType / outputType. */
export type TypeDescriptor = TypeExpression;

export interface Multiplicity {
  min: number;
  max: number | "*";
}

export interface InstanceConfiguration {
  /** Named configuration — ValueType property name → value. */
  named?: Record<string, LiteralValue | ExpressionValue>;
  /** Positional configuration — mapped by ValueType property declaration order. */
  positional?: (LiteralValue | ExpressionValue)[];
}

export interface NamedTypeReference {
  kind: "named";
  fqn: string;
  typeArguments?: TypeExpression[];
  instanceConfiguration?: InstanceConfiguration;
  multiplicity?: Multiplicity;
}

export interface UnionTypeExpression {
  kind: "union";
  alternatives: TypeExpression[];
}

export interface GroupedTypeExpression {
  kind: "grouped";
  expression: TypeExpression;
  multiplicity?: Multiplicity;
}

export interface GenericParameterReference {
  kind: "genericParam";
  name: string;
}

export interface SelfTypeReference {
  kind: "self";
}

export interface AnonymousStructType {
  kind: "anonymousStruct";
  fields: StructField[];
}

export interface StructField {
  name: string;
  type: TypeExpression;
}
