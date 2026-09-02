import type { Multiplicity, TypeExpression } from "@blockml/bom";

export interface NamedTypeRef {
  fqn: string;
  cardinality?: string;
}

export function multiplicityLabel(multiplicity?: Multiplicity): string | undefined {
  if (!multiplicity) {
    return undefined;
  }
  const max = multiplicity.max === "*" ? "n" : String(multiplicity.max);
  return `${multiplicity.min}..${max}`;
}

export function collectNamedTypes(expr: TypeExpression | undefined): NamedTypeRef[] {
  if (!expr) {
    return [];
  }
  const out: NamedTypeRef[] = [];
  walk(expr, undefined);
  return out;

  function walk(current: TypeExpression, inherited?: string): void {
    switch (current.kind) {
      case "named": {
        const cardinality = multiplicityLabel(current.multiplicity) ?? inherited;
        const named: NamedTypeRef = { fqn: current.fqn };
        if (cardinality) {
          named.cardinality = cardinality;
        }
        out.push(named);
        for (const arg of current.typeArguments ?? []) {
          walk(arg, undefined);
        }
        break;
      }
      case "union":
        for (const alternative of current.alternatives) {
          walk(alternative, inherited);
        }
        break;
      case "grouped":
        walk(current.expression, multiplicityLabel(current.multiplicity) ?? inherited);
        break;
      case "anonymousStruct":
        for (const field of current.fields) {
          walk(field.type, inherited);
        }
        break;
      case "genericParam":
      case "self":
        break;
    }
  }
}
