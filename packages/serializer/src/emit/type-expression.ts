import type { TypeExpression } from "@blockml/bom";
import { fqnToQName, hasBmlSemanticQNameBindings } from "./qname.js";

export function emitTypeExpression(
  type: TypeExpression,
  bindings: Record<string, string>,
  useQName: boolean,
): string {
  switch (type.kind) {
    case "self":
      return "bml:Self";
    case "genericParam":
      return type.name;
    case "anonymousStruct":
      return `{ ${type.fields.map((f) => `${f.name}: ${emitTypeExpression(f.type, bindings, useQName)}`).join(", ")} }`;
    case "union":
      return type.alternatives
        .map((a) => emitTypeExpression(a, bindings, useQName))
        .join(" | ");
    case "grouped": {
      const inner = emitTypeExpression(type.expression, bindings, useQName);
      const suffix = type.multiplicity ? formatMultiplicity(type.multiplicity) : "";
      return `(${inner})${suffix}`;
    }
    case "named": {
      let base = useQName ? fqnToQName(type.fqn, bindings) : type.fqn;
      if (type.typeArguments?.length) {
        base += `(${type.typeArguments.map((a) => emitTypeExpression(a, bindings, useQName)).join(", ")})`;
      }
      if (type.instanceConfiguration?.named) {
        const pairs = Object.entries(type.instanceConfiguration.named).map(
          ([k, v]) => `${k}: ${emitConfigValue(v)}`,
        );
        base += `{ ${pairs.join(", ")} }`;
      } else if (type.instanceConfiguration?.positional?.length) {
        base += `{ ${type.instanceConfiguration.positional.map(emitConfigValue).join(", ")} }`;
      }
      if (type.multiplicity) {
        base += formatMultiplicity(type.multiplicity);
      }
      return base;
    }
  }
}

function formatMultiplicity(m: { min: number; max: number | "*" }): string {
  const { min, max } = m;
  if (min === 0 && max === "*") {
    return "[]";
  }
  if (min === max) {
    return `[${min}]`;
  }
  return `[${min}..${max}]`;
}

function emitConfigValue(v: { kind: string; value?: unknown; raw?: string }): string {
  if (v.kind === "expression") {
    return `\${ ${v.raw} }`;
  }
  if (typeof v.value === "string") {
    return `"${v.value}"`;
  }
  return String(v.value);
}

export function shouldUseQName(bindings: Record<string, string>): boolean {
  return hasBmlSemanticQNameBindings(bindings);
}

export { fqnToQName };
