import type {
  BlockDefinition,
  PropertyDefinition,
  TypeExpression,
} from "@blockml/bom";
import {
  collectBaseTypeChain,
  resolveEffectiveMembers,
  type TypeRegistry,
} from "@blockml/framework";
import { TransformError } from "./errors.js";
import {
  BOOLEAN_TYPE_FQN,
  INTEGER_TYPE_FQN,
  MODEL_TRANSFORMATION_FQN,
} from "./constants.js";
import { getPropertyLiteral, setOverrideProperty } from "./properties.js";

export const EMPTY_STRUCT_FQN = "org.blockml.bml.type.EmptyStruct";
export const STRUCT_TYPE_FQN = "org.blockml.bml.type.StructType";
export const NUMBER_TYPE_FQN = "org.blockml.bml.type.Number";
export const PRIMITIVE_TYPE_FQN = "org.blockml.bml.type.PrimitiveType";

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseParametersJson(raw: string | undefined): Record<string, unknown> {
  if (raw === undefined) {
    return {};
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new TransformError("resolve", "Invalid --parameters JSON");
  }
  if (!isPlainObject(parsed)) {
    throw new TransformError("resolve", "--parameters must be a JSON object");
  }
  return parsed;
}

export function deepMergeParameters(
  base: Record<string, unknown>,
  overlay: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    const existing = result[key];
    if (isPlainObject(existing) && isPlainObject(value)) {
      result[key] = deepMergeParameters(existing, value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function pendingParametersObject(block: BlockDefinition): Record<string, unknown> {
  const value = getPropertyLiteral(block, "parameters");
  if (value === undefined) {
    return {};
  }
  if (!isPlainObject(value)) {
    throw new TransformError(
      "resolve",
      "pending parameters must be a JSON object",
    );
  }
  return value;
}

export function resolveParametersTypeFqn(block: BlockDefinition): string {
  const fromExpression = namedArgumentFqn(block.baseTypeExpression);
  if (fromExpression) {
    return fromExpression;
  }
  return EMPTY_STRUCT_FQN;
}

function namedArgumentFqn(expr: TypeExpression | undefined): string | undefined {
  if (expr?.kind !== "named" || expr.fqn !== MODEL_TRANSFORMATION_FQN) {
    return undefined;
  }
  const arg = expr.typeArguments?.[0];
  return arg?.kind === "named" ? arg.fqn : undefined;
}

export function assertParametersCompatible(
  value: Record<string, unknown>,
  typeFqn: string,
  registry: TypeRegistry,
  path = "parameters",
): void {
  assertValueCompatible(value, typeFqn, registry, path);
}

function assertValueCompatible(
  value: unknown,
  typeFqn: string,
  registry: TypeRegistry,
  path: string,
): void {
  if (extendsType(typeFqn, STRUCT_TYPE_FQN, registry) || typeFqn === EMPTY_STRUCT_FQN) {
    if (!isPlainObject(value)) {
      throw new TransformError("resolve", `${path} must be an object`);
    }
    const fields = structFields(typeFqn, registry);
    const allowed = new Set(fields.map((field) => field.name));
    for (const key of Object.keys(value)) {
      if (!allowed.has(key)) {
        throw new TransformError(
          "resolve",
          `Unknown parameter ${path === "parameters" ? key : `${path}.${key}`}`,
        );
      }
    }
    for (const field of fields) {
      if (!(field.name in value)) {
        continue;
      }
      const fieldType = propertyTypeFqn(field);
      if (!fieldType) {
        continue;
      }
      const fieldPath = path === "parameters" ? field.name : `${path}.${field.name}`;
      assertValueCompatible(value[field.name], fieldType, registry, fieldPath);
    }
    return;
  }
  if (typeFqn === BOOLEAN_TYPE_FQN || extendsType(typeFqn, BOOLEAN_TYPE_FQN, registry)) {
    if (typeof value !== "boolean") {
      throw new TransformError("resolve", `${path} must be a boolean`);
    }
    return;
  }
  if (typeFqn === INTEGER_TYPE_FQN || extendsType(typeFqn, INTEGER_TYPE_FQN, registry)) {
    if (typeof value !== "number" || !Number.isInteger(value)) {
      throw new TransformError("resolve", `${path} must be an integer`);
    }
    return;
  }
  if (extendsType(typeFqn, NUMBER_TYPE_FQN, registry)) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new TransformError("resolve", `${path} must be a number`);
    }
    return;
  }
  if (typeof value === "string") {
    return;
  }
  throw new TransformError(
    "resolve",
    `${path} is not compatible with ${typeFqn}`,
  );
}

function structFields(
  typeFqn: string,
  registry: TypeRegistry,
): PropertyDefinition[] {
  const typeBlock = registry.get(typeFqn)?.block;
  if (!typeBlock) {
    return [];
  }
  return resolveEffectiveMembers(typeBlock, registry).filter(
    (member): member is PropertyDefinition => member.kind === "property",
  );
}

function propertyTypeFqn(member: PropertyDefinition): string | undefined {
  if (member.typeFqn) {
    return member.typeFqn;
  }
  if (member.type?.kind === "named") {
    return member.type.fqn;
  }
  return undefined;
}

function extendsType(
  typeFqn: string,
  targetFqn: string,
  registry: TypeRegistry,
): boolean {
  if (typeFqn === targetFqn) {
    return true;
  }
  const typeBlock = registry.get(typeFqn)?.block;
  if (!typeBlock) {
    return false;
  }
  if (typeBlock.baseType === targetFqn) {
    return true;
  }
  return collectBaseTypeChain(typeBlock, registry).some(
    (entry) => entry.type === targetFqn || entry.baseType === targetFqn,
  );
}

export function applyExecutionParameters(
  block: BlockDefinition,
  registry: TypeRegistry,
  cliParameters: Record<string, unknown> = {},
): Record<string, unknown> {
  const typeFqn = resolveParametersTypeFqn(block);
  const merged = deepMergeParameters(
    pendingParametersObject(block),
    cliParameters,
  );
  assertParametersCompatible(merged, typeFqn, registry);
  setOverrideProperty(block, "parameters", typeFqn, merged);
  return merged;
}

export function rewriteParameterTypeFqns(
  block: BlockDefinition,
  fromFqn: string,
  toFqn: string,
): void {
  const rewrite = (value: string): string =>
    value === fromFqn || value.startsWith(`${fromFqn}.`)
      ? `${toFqn}${value.slice(fromFqn.length)}`
      : value;
  const expr = block.baseTypeExpression;
  if (expr?.kind === "named") {
    for (const arg of expr.typeArguments ?? []) {
      if (arg.kind === "named") {
        arg.fqn = rewrite(arg.fqn);
      }
    }
  }
  for (const sub of block.subBlocks) {
    sub.type = rewrite(sub.type);
    rewriteParameterTypeFqns(sub, fromFqn, toFqn);
  }
  for (const member of block.members) {
    if (member.kind !== "property" || member.name !== "parameters") {
      continue;
    }
    if (member.typeFqn) {
      member.typeFqn = rewrite(member.typeFqn);
    }
    if (member.type?.kind === "named") {
      member.type.fqn = rewrite(member.type.fqn);
    }
  }
}
