import type { Multiplicity, TypeExpression } from "@blockml/bom";
import type { InspectTypeRef } from "./types.js";

export function multiplicityLabel(multiplicity?: Multiplicity): string | undefined {
  if (!multiplicity) {
    return undefined;
  }
  const max = multiplicity.max === "*" ? "n" : String(multiplicity.max);
  return `${multiplicity.min}..${max}`;
}

export function projectTypeExpression(
  expr: TypeExpression | undefined,
  typeFqn?: string,
): InspectTypeRef | undefined {
  if (!expr) {
    if (!typeFqn) {
      return undefined;
    }
    return { kind: "named", ref: typeFqn };
  }
  return walk(expr);
}

export function collectNamedFqns(expr: TypeExpression | undefined, typeFqn?: string): string[] {
  const out: string[] = [];
  if (typeFqn) {
    out.push(typeFqn);
  }
  if (expr) {
    walkNamed(expr, out);
  }
  return [...new Set(out)];
}

function walk(current: TypeExpression): InspectTypeRef {
  switch (current.kind) {
    case "named": {
      const hasArgs = (current.typeArguments?.length ?? 0) > 0;
      const projected: InspectTypeRef = {
        kind: hasArgs ? "generic" : "named",
        ref: current.fqn,
      };
      if (hasArgs) {
        projected.args = current.typeArguments!.map((arg) => walk(arg));
      }
      const multiplicity = multiplicityLabel(current.multiplicity);
      if (multiplicity) {
        projected.multiplicity = multiplicity;
      }
      return projected;
    }
    case "union":
      return {
        kind: "union",
        alternatives: current.alternatives.map((alt) => walk(alt)),
      };
    case "grouped": {
      const grouped: InspectTypeRef = {
        kind: "grouped",
        expression: walk(current.expression),
      };
      const multiplicity = multiplicityLabel(current.multiplicity);
      if (multiplicity) {
        grouped.multiplicity = multiplicity;
      }
      return grouped;
    }
    case "anonymousStruct":
      return {
        kind: "anonymousStruct",
        fields: current.fields.map((field) => ({
          name: field.name,
          type: walk(field.type),
        })),
      };
    case "genericParam":
      return { kind: "genericParam", name: current.name };
    case "self":
      return { kind: "self" };
  }
}

function walkNamed(current: TypeExpression, out: string[]): void {
  switch (current.kind) {
    case "named": {
      out.push(current.fqn);
      for (const arg of current.typeArguments ?? []) {
        walkNamed(arg, out);
      }
      break;
    }
    case "union":
      for (const alternative of current.alternatives) {
        walkNamed(alternative, out);
      }
      break;
    case "grouped":
      walkNamed(current.expression, out);
      break;
    case "anonymousStruct":
      for (const field of current.fields) {
        walkNamed(field.type, out);
      }
      break;
    case "genericParam":
    case "self":
      break;
  }
}
