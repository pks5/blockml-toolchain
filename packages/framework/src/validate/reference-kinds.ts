import type { TypeExpression } from "@blockml/bom";
import type { TypeRegistry } from "../registry/type-registry.js";
import { satisfiesTypeBound } from "../resolve/satisfies-type-bound.js";

export const TYPE_REFERENCE = "org.blockml.bml.type.TypeReference";
export const TYPE_REFERENCE_ENTITY = "org.blockml.bml.type.TypeReferenceEntity";
export const PACKAGE_REFERENCE = "org.blockml.bml.type.PackageReference";
export const PACKAGE_REFERENCE_ENTITY = "org.blockml.bml.type.PackageReferenceEntity";
export const INSTANCE_REFERENCE = "org.blockml.bml.type.InstanceReference";
export const INSTANCE_REFERENCE_ENTITY = "org.blockml.bml.type.InstanceReferenceEntity";
export const PROPERTY_REFERENCE = "org.blockml.bml.type.PropertyReference";
export const PROPERTY_REFERENCE_ENTITY = "org.blockml.bml.type.PropertyReferenceEntity";
export const AGGREGATION_REFERENCE = "org.blockml.bml.type.AggregationReference";
export const AGGREGATION_REFERENCE_ENTITY = "org.blockml.bml.type.AggregationReferenceEntity";
export const ASSOCIATION_REFERENCE = "org.blockml.bml.type.AssociationReference";
export const ASSOCIATION_REFERENCE_ENTITY = "org.blockml.bml.type.AssociationReferenceEntity";
export const CAPABILITY_REFERENCE = "org.blockml.bml.type.CapabilityReference";
export const CAPABILITY_REFERENCE_ENTITY = "org.blockml.bml.type.CapabilityReferenceEntity";

export const TYPE_IDENTIFIER = "org.blockml.bml.type.TypeIdentifier";
export const TYPE_IDENTIFIER_ENTITY = "org.blockml.bml.type.TypeIdentifierEntity";
export const PACKAGE_IDENTIFIER = "org.blockml.bml.type.PackageIdentifier";
export const PACKAGE_IDENTIFIER_ENTITY = "org.blockml.bml.type.PackageIdentifierEntity";
export const INSTANCE_IDENTIFIER = "org.blockml.bml.type.InstanceIdentifier";
export const INSTANCE_IDENTIFIER_ENTITY = "org.blockml.bml.type.InstanceIdentifierEntity";
export const MEMBER_IDENTIFIER = "org.blockml.bml.type.MemberIdentifier";
export const MEMBER_IDENTIFIER_ENTITY = "org.blockml.bml.type.MemberIdentifierEntity";
export const PROPERTY_IDENTIFIER = "org.blockml.bml.type.PropertyIdentifier";
export const PROPERTY_IDENTIFIER_ENTITY = "org.blockml.bml.type.PropertyIdentifierEntity";
export const AGGREGATION_IDENTIFIER = "org.blockml.bml.type.AggregationIdentifier";
export const AGGREGATION_IDENTIFIER_ENTITY = "org.blockml.bml.type.AggregationIdentifierEntity";
export const ASSOCIATION_IDENTIFIER = "org.blockml.bml.type.AssociationIdentifier";
export const ASSOCIATION_IDENTIFIER_ENTITY = "org.blockml.bml.type.AssociationIdentifierEntity";
export const CAPABILITY_IDENTIFIER = "org.blockml.bml.type.CapabilityIdentifier";
export const CAPABILITY_IDENTIFIER_ENTITY = "org.blockml.bml.type.CapabilityIdentifierEntity";

export type ReferenceKind =
  | "type"
  | "package"
  | "instance"
  | "property"
  | "aggregation"
  | "association"
  | "capability";

export type ClassifiedDeclaredType =
  | { role: "reference"; kind: ReferenceKind; isEntity: boolean; boundFqn?: string }
  | { role: "identifier" };

type ReferencePair = {
  kind: ReferenceKind;
  reference: string;
  entity: string;
};

const REFERENCE_PAIRS: ReferencePair[] = [
  { kind: "type", reference: TYPE_REFERENCE, entity: TYPE_REFERENCE_ENTITY },
  { kind: "package", reference: PACKAGE_REFERENCE, entity: PACKAGE_REFERENCE_ENTITY },
  { kind: "instance", reference: INSTANCE_REFERENCE, entity: INSTANCE_REFERENCE_ENTITY },
  { kind: "property", reference: PROPERTY_REFERENCE, entity: PROPERTY_REFERENCE_ENTITY },
  { kind: "aggregation", reference: AGGREGATION_REFERENCE, entity: AGGREGATION_REFERENCE_ENTITY },
  { kind: "association", reference: ASSOCIATION_REFERENCE, entity: ASSOCIATION_REFERENCE_ENTITY },
  { kind: "capability", reference: CAPABILITY_REFERENCE, entity: CAPABILITY_REFERENCE_ENTITY },
];

const IDENTIFIER_FQNS = [
  TYPE_IDENTIFIER,
  TYPE_IDENTIFIER_ENTITY,
  PACKAGE_IDENTIFIER,
  PACKAGE_IDENTIFIER_ENTITY,
  INSTANCE_IDENTIFIER,
  INSTANCE_IDENTIFIER_ENTITY,
  MEMBER_IDENTIFIER,
  MEMBER_IDENTIFIER_ENTITY,
  PROPERTY_IDENTIFIER,
  PROPERTY_IDENTIFIER_ENTITY,
  AGGREGATION_IDENTIFIER,
  AGGREGATION_IDENTIFIER_ENTITY,
  ASSOCIATION_IDENTIFIER,
  ASSOCIATION_IDENTIFIER_ENTITY,
  CAPABILITY_IDENTIFIER,
  CAPABILITY_IDENTIFIER_ENTITY,
];

export function unwrapNamed(expr: TypeExpression | undefined): {
  fqn: string;
  typeArguments?: TypeExpression[];
} | undefined {
  if (!expr) {
    return undefined;
  }
  if (expr.kind === "named") {
    return expr;
  }
  if (expr.kind === "grouped") {
    return unwrapNamed(expr.expression);
  }
  if (expr.kind === "union") {
    return unwrapNamed(expr.alternatives[0]);
  }
  return undefined;
}

export function namedTypeFqn(expr: TypeExpression | undefined, fallback?: string): string | undefined {
  return unwrapNamed(expr)?.fqn ?? fallback;
}

export function firstTypeArgumentFqn(expr: TypeExpression | undefined): string | undefined {
  const named = unwrapNamed(expr);
  const arg = named?.typeArguments?.[0];
  return namedTypeFqn(arg);
}

export function classifyDeclaredFqn(
  fqn: string,
  registry: TypeRegistry,
  boundFqn?: string,
): ClassifiedDeclaredType | undefined {
  for (const pair of REFERENCE_PAIRS) {
    const isEntity = satisfiesTypeBound(fqn, pair.entity, registry);
    if (isEntity || satisfiesTypeBound(fqn, pair.reference, registry)) {
      const classified: ClassifiedDeclaredType = {
        role: "reference",
        kind: pair.kind,
        isEntity,
      };
      if (boundFqn) {
        classified.boundFqn = boundFqn;
      }
      return classified;
    }
  }
  for (const ident of IDENTIFIER_FQNS) {
    if (satisfiesTypeBound(fqn, ident, registry)) {
      return { role: "identifier" };
    }
  }
  return undefined;
}

export function classifyDeclaredType(
  expr: TypeExpression | undefined,
  registry: TypeRegistry,
  fallbackFqn?: string,
): ClassifiedDeclaredType | undefined {
  const fqn = namedTypeFqn(expr, fallbackFqn);
  if (!fqn) {
    return undefined;
  }
  return classifyDeclaredFqn(fqn, registry, firstTypeArgumentFqn(expr));
}
