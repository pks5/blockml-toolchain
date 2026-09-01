import type { GenericType, TypeExpression } from "@blockml/bom";
import { parseTypeExpression } from "@blockml/parser";
import type { TypeRegistry } from "../registry/type-registry.js";
import { satisfiesTypeBound } from "./satisfies-type-bound.js";

export type GenericApplicationDiagnostic = {
  code:
    | "BML_GENERICS_ARGUMENT_MISMATCH"
    | "BML_MISSING_GENERIC_TYPE_ARGUMENT"
    | "BML_GENERIC_CONSTRAINT_VIOLATION";
  message: string;
};

export type GenericApplicationResult = {
  bindings: Map<string, TypeExpression>;
  diagnostics: GenericApplicationDiagnostic[];
};

function namedFqns(expr: TypeExpression): string[] {
  switch (expr.kind) {
    case "named":
      return [expr.fqn];
    case "union":
      return expr.alternatives.flatMap(namedFqns);
    case "grouped":
      return namedFqns(expr.expression);
    default:
      return [];
  }
}

function isConcreteType(expr: TypeExpression): boolean {
  switch (expr.kind) {
    case "named":
      return true;
    case "union":
      return expr.alternatives.every(isConcreteType);
    case "grouped":
      return isConcreteType(expr.expression);
    default:
      return false;
  }
}

function resolveDefaultType(
  param: GenericType,
  params: GenericType[],
  resolved: Map<string, TypeExpression>,
  bindings: Record<string, string>,
  visiting: Set<string>,
): TypeExpression | undefined {
  const raw = param.defaultType?.trim();
  if (!raw) {
    return undefined;
  }
  if (visiting.has(param.name)) {
    return undefined;
  }
  visiting.add(param.name);

  let expr: TypeExpression;
  try {
    expr = parseTypeExpression(raw, bindings, "type");
  } catch {
    visiting.delete(param.name);
    return undefined;
  }

  if (expr.kind === "genericParam") {
    const sibling = resolved.get(expr.name);
    if (sibling) {
      visiting.delete(param.name);
      return sibling;
    }
    const earlier = params.find((p) => p.name === expr.name);
    if (!earlier || params.indexOf(earlier) >= params.indexOf(param)) {
      visiting.delete(param.name);
      return undefined;
    }
    const fromSibling = resolveDefaultType(earlier, params, resolved, bindings, visiting);
    visiting.delete(param.name);
    return fromSibling;
  }

  visiting.delete(param.name);
  return isConcreteType(expr) ? expr : undefined;
}

function argumentSatisfiesBound(
  arg: TypeExpression,
  boundFqn: string,
  registry: TypeRegistry,
): boolean {
  const fqns = namedFqns(arg);
  if (fqns.length === 0) {
    return false;
  }
  return fqns.every((fqn) => satisfiesTypeBound(fqn, boundFqn, registry));
}

/**
 * Bind authored type arguments to declared genericTypes.
 * Authored args win; remaining parameters take defaultType in declaration order.
 */
export function resolveGenericApplication(
  params: GenericType[],
  authoredArgs: TypeExpression[],
  registry: TypeRegistry,
  namespaceBindings: Record<string, string> = {},
): GenericApplicationResult {
  const diagnostics: GenericApplicationDiagnostic[] = [];
  const bindings = new Map<string, TypeExpression>();

  if (authoredArgs.length > params.length) {
    diagnostics.push({
      code: "BML_GENERICS_ARGUMENT_MISMATCH",
      message: `bml:generics has ${authoredArgs.length} argument(s); expected at most ${params.length}`,
    });
    return { bindings, diagnostics };
  }

  for (let i = 0; i < params.length; i++) {
    const param = params[i]!;
    const authored = authoredArgs[i];
    if (authored) {
      bindings.set(param.name, authored);
      continue;
    }
    const fallback = resolveDefaultType(
      param,
      params,
      bindings,
      namespaceBindings,
      new Set(),
    );
    if (fallback) {
      bindings.set(param.name, fallback);
      continue;
    }
    diagnostics.push({
      code: "BML_MISSING_GENERIC_TYPE_ARGUMENT",
      message: `Missing generic type argument for ${param.name}`,
    });
  }

  for (const param of params) {
    const bound = bindings.get(param.name);
    if (!bound) {
      continue;
    }
    if (!argumentSatisfiesBound(bound, param.baseType, registry)) {
      diagnostics.push({
        code: "BML_GENERIC_CONSTRAINT_VIOLATION",
        message: `Type argument for ${param.name} does not satisfy bound ${param.baseType}`,
      });
    }
  }

  return { bindings, diagnostics };
}

/** Parameters that do not ground from defaultType alone — the instance is open. */
export function openGenericParameters(
  params: GenericType[],
  namespaceBindings: Record<string, string> = {},
): GenericType[] {
  const resolved = new Map<string, TypeExpression>();
  const open: GenericType[] = [];
  for (const param of params) {
    const fallback = resolveDefaultType(
      param,
      params,
      resolved,
      namespaceBindings,
      new Set(),
    );
    if (fallback) {
      resolved.set(param.name, fallback);
    } else {
      open.push(param);
    }
  }
  return open;
}
