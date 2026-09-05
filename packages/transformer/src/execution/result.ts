import type {
  BlockDefinition,
  BlockInstance,
  MemberValue,
  PropertyDefinition,
  TypeExpression,
} from "@blockml/bom";
import {
  collectBaseTypeChain,
  ExpressionEvaluationError,
  resolveEffectiveMembers,
  type TypeRegistry,
} from "@blockml/framework";
import {
  MODEL_TRANSFORMATION_FQN,
  TEXT_TYPE_FQN,
} from "./constants.js";
import {
  buildBlockEvaluationScope,
  closeMemberValue,
} from "./interpolate.js";
import {
  EMPTY_STRUCT_FQN,
  isPlainObject,
  STRUCT_TYPE_FQN,
} from "./constants.js";
import {
  getOperationResultMappings,
  getPropertyLiteral,
  setResult,
} from "./properties.js";
import {
  lookupReferencedProperty,
  propertyLiteral,
  propertyTypeFqn,
} from "./property-reference.js";

export class ResultResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResultResolutionError";
  }
}

export type PathSegment =
  | { kind: "index"; value: number }
  | { kind: "name"; value: string };

export interface ResolvedType {
  fqn: string;
  array: boolean;
}

export function resolveResultTypeFqn(block: BlockDefinition): string {
  return resolveResultType(block).fqn;
}

export function resolveResultType(block: BlockDefinition): ResolvedType {
  const arg = resultTypeArgument(block.baseTypeExpression);
  if (arg) {
    return typeFromExpression(arg);
  }
  return { fqn: TEXT_TYPE_FQN, array: false };
}

function resultTypeArgument(expr: TypeExpression | undefined): TypeExpression | undefined {
  if (expr?.kind !== "named" || expr.fqn !== MODEL_TRANSFORMATION_FQN) {
    return undefined;
  }
  return expr.typeArguments?.[1];
}

/**
 * Apply each ResultMapping on the operation onto transformation.result.
 * No-op when the operation has no mappings.
 */
export function applyOperationResultMappings(
  transformation: BlockDefinition,
  operation: BlockInstance,
  registry: TypeRegistry,
): void {
  const mappings = getOperationResultMappings(operation);
  if (mappings.length === 0) {
    return;
  }
  const resultType = resolveResultType(transformation);
  for (const mapping of mappings) {
    applyOneMapping(transformation, mapping, resultType, registry);
  }
}

function applyOneMapping(
  transformation: BlockDefinition,
  mapping: BlockInstance,
  resultType: ResolvedType,
  registry: TypeRegistry,
): void {
  let raw: string;
  try {
    raw = closeSource(transformation, mapping.memberValues.source);
  } catch (error) {
    if (error instanceof ExpressionEvaluationError) {
      throw new ResultResolutionError(error.message);
    }
    throw error;
  }

  const lookedUp = lookupReferencedProperty(raw, registry, "source");
  if ("error" in lookedUp) {
    throw new ResultResolutionError(lookedUp.error);
  }

  const sourceType = typeFromProperty(lookedUp.property);
  const sourcePath = parseModelPath(mappingText(mapping, "sourcePath"), "sourcePath");
  const resultPath = parseModelPath(mappingText(mapping, "resultPath"), "resultPath");

  const selectedType = walkType(sourceType, sourcePath, registry, "sourcePath");
  const sourceValue = propertyLiteral(lookedUp.property);
  if (sourceValue === undefined) {
    throw new ResultResolutionError(
      `source property ${lookedUp.blockFqn}.properties.${lookedUp.propertyName} has no value`,
    );
  }
  const selectedValue = readPath(sourceValue, sourcePath, "sourcePath");

  if (resultPath.length === 0) {
    if (!typesEqual(selectedType, resultType)) {
      throw new ResultResolutionError(
        `source type ${formatType(selectedType)} does not match result type ${formatType(resultType)}`,
      );
    }
    setResult(transformation, resultType.fqn, selectedValue);
    return;
  }

  const targetType = walkType(resultType, resultPath, registry, "resultPath");
  if (!typesEqual(selectedType, targetType)) {
    throw new ResultResolutionError(
      `source type ${formatType(selectedType)} does not match result path type ${formatType(targetType)}`,
    );
  }

  const current = getPropertyLiteral(transformation, "result");
  const next = writePath(current, resultPath, selectedValue, resultType, registry);
  setResult(transformation, resultType.fqn, next);
}

function closeSource(transformation: BlockDefinition, value: MemberValue | undefined): string {
  if (!value) {
    throw new ResultResolutionError("source is required");
  }
  const closed = closeMemberValue(value, buildBlockEvaluationScope(transformation));
  if (closed.kind !== "literal" || typeof closed.value !== "string") {
    throw new ResultResolutionError("source must close to a PropertyIdentifier path");
  }
  const trimmed = closed.value.trim();
  if (trimmed === "") {
    throw new ResultResolutionError("source is required");
  }
  return trimmed;
}

function mappingText(mapping: BlockInstance, name: string): string | undefined {
  const value = mapping.memberValues[name];
  if (!value) {
    return undefined;
  }
  if (value.kind === "literal" && typeof value.value === "string") {
    const trimmed = value.value.trim();
    return trimmed === "" ? undefined : trimmed;
  }
  if (value.kind === "interpolated" || value.kind === "expression") {
    return undefined;
  }
  return undefined;
}

export function parseModelPath(raw: string | undefined, label: string): PathSegment[] {
  if (raw === undefined || raw === "") {
    return [];
  }
  if (!raw.startsWith("/")) {
    throw new ResultResolutionError(`${label} "${raw}" must start with /`);
  }
  const parts = raw.split("/").slice(1);
  if (parts.length === 0 || parts.some((part) => part === "")) {
    throw new ResultResolutionError(`${label} "${raw}" is not a valid OpenUI5 model path`);
  }
  return parts.map((part) => {
    if (/^\d+$/.test(part)) {
      return { kind: "index" as const, value: Number(part) };
    }
    return { kind: "name" as const, value: part };
  });
}

export function walkType(
  start: ResolvedType,
  path: PathSegment[],
  registry: TypeRegistry,
  label: string,
): ResolvedType {
  let current = start;
  for (let index = 0; index < path.length; index++) {
    const segment = path[index]!;
    if (current.array) {
      if (segment.kind !== "index") {
        throw new ResultResolutionError(
          `${label} segment "${segment.value}" is not valid on an array; expected an index`,
        );
      }
      current = { fqn: current.fqn, array: false };
      continue;
    }
    if (segment.kind === "index") {
      throw new ResultResolutionError(
        `${label} segment "${segment.value}" is not valid; a non-array StructType path must start with a field name`,
      );
    }
    if (!isStructType(current.fqn, registry)) {
      throw new ResultResolutionError(
        `${label} is not valid on ${formatType(current)}`,
      );
    }
    const field = structField(current.fqn, segment.value, registry);
    if (!field) {
      throw new ResultResolutionError(
        `${label} field ${segment.value} was not found on ${current.fqn}`,
      );
    }
    current = typeFromProperty(field);
  }
  return current;
}

export function readPath(value: unknown, path: PathSegment[], label: string): unknown {
  let current = value;
  for (const segment of path) {
    if (segment.kind === "index") {
      if (!Array.isArray(current)) {
        throw new ResultResolutionError(`${label} expected an array`);
      }
      if (segment.value < 0 || segment.value >= current.length) {
        throw new ResultResolutionError(
          `${label} index ${segment.value} is out of range`,
        );
      }
      current = current[segment.value];
      continue;
    }
    if (!isPlainObject(current)) {
      throw new ResultResolutionError(`${label} expected a struct`);
    }
    if (!(segment.value in current)) {
      throw new ResultResolutionError(`${label} field ${segment.value} is missing`);
    }
    current = current[segment.value];
  }
  return current;
}

export function writePath(
  root: unknown,
  path: PathSegment[],
  value: unknown,
  startType: ResolvedType,
  registry: TypeRegistry,
  label = "resultPath",
): unknown {
  if (path.length === 0) {
    return value;
  }
  const next = root === undefined ? emptyOf(startType, registry, label) : cloneValue(root);
  writeInto(next, path, value, startType, registry, label);
  return next;
}

function writeInto(
  container: unknown,
  path: PathSegment[],
  value: unknown,
  containerType: ResolvedType,
  registry: TypeRegistry,
  label: string,
): void {
  const [segment, ...rest] = path;
  if (!segment) {
    return;
  }
  const last = rest.length === 0;
  if (containerType.array) {
    if (segment.kind !== "index") {
      throw new ResultResolutionError(
        `${label} segment "${segment.value}" is not valid on an array; expected an index`,
      );
    }
    if (!Array.isArray(container)) {
      throw new ResultResolutionError(`${label} expected an array`);
    }
    if (segment.value < 0 || segment.value > container.length) {
      throw new ResultResolutionError(
        `${label} index ${segment.value} is out of range`,
      );
    }
    const elementType: ResolvedType = { fqn: containerType.fqn, array: false };
    if (segment.value === container.length) {
      container.push(last ? value : emptyOf(elementType, registry, label));
    }
    if (last) {
      container[segment.value] = value;
      return;
    }
    writeInto(container[segment.value], rest, value, elementType, registry, label);
    return;
  }
  if (segment.kind === "index") {
    throw new ResultResolutionError(
      `${label} segment "${segment.value}" is not valid; a non-array StructType path must start with a field name`,
    );
  }
  if (!isPlainObject(container)) {
    throw new ResultResolutionError(`${label} expected a struct`);
  }
  const field = structField(containerType.fqn, segment.value, registry);
  if (!field) {
    throw new ResultResolutionError(
      `${label} field ${segment.value} was not found on ${containerType.fqn}`,
    );
  }
  const fieldType = typeFromProperty(field);
  if (last) {
    container[segment.value] = value;
    return;
  }
  if (!(segment.value in container) || container[segment.value] === undefined) {
    container[segment.value] = emptyOf(fieldType, registry, label);
  }
  writeInto(container[segment.value], rest, value, fieldType, registry, label);
}

function emptyOf(type: ResolvedType, registry: TypeRegistry, label: string): unknown {
  if (type.array) {
    return [];
  }
  if (isStructType(type.fqn, registry)) {
    return {};
  }
  throw new ResultResolutionError(
    `${label} is not valid on ${formatType(type)}`,
  );
}

function typeFromProperty(property: PropertyDefinition): ResolvedType {
  if (property.type) {
    const fromExpr = typeFromExpression(property.type);
    if (!fromExpr.fqn && property.typeFqn) {
      return { fqn: property.typeFqn, array: fromExpr.array };
    }
    return fromExpr;
  }
  return { fqn: propertyTypeFqn(property) ?? "", array: false };
}

export function typeFromExpression(expr: TypeExpression): ResolvedType {
  if (expr.kind === "named") {
    return { fqn: expr.fqn, array: isArrayMultiplicity(expr.multiplicity) };
  }
  if (expr.kind === "grouped") {
    const inner = typeFromExpression(expr.expression);
    return {
      fqn: inner.fqn,
      array: isArrayMultiplicity(expr.multiplicity) || inner.array,
    };
  }
  return { fqn: "", array: false };
}

function isArrayMultiplicity(
  multiplicity: { min: number; max: number | "*" } | undefined,
): boolean {
  if (!multiplicity) {
    return false;
  }
  return multiplicity.max === "*" || multiplicity.max > 1 || multiplicity.min > 1;
}

function typesEqual(left: ResolvedType, right: ResolvedType): boolean {
  return left.fqn === right.fqn && left.array === right.array;
}

function formatType(type: ResolvedType): string {
  return type.array ? `${type.fqn}[]` : type.fqn;
}

function isStructType(typeFqn: string, registry: TypeRegistry): boolean {
  if (typeFqn === STRUCT_TYPE_FQN || typeFqn === EMPTY_STRUCT_FQN) {
    return true;
  }
  const typeBlock = registry.get(typeFqn)?.block;
  if (!typeBlock) {
    return false;
  }
  if (typeBlock.baseType === STRUCT_TYPE_FQN) {
    return true;
  }
  return collectBaseTypeChain(typeBlock, registry).some(
    (entry) => entry.type === STRUCT_TYPE_FQN || entry.baseType === STRUCT_TYPE_FQN,
  );
}

function structField(
  typeFqn: string,
  name: string,
  registry: TypeRegistry,
): PropertyDefinition | undefined {
  const typeBlock = registry.get(typeFqn)?.block;
  if (!typeBlock) {
    return undefined;
  }
  return resolveEffectiveMembers(typeBlock, registry).find(
    (member): member is PropertyDefinition =>
      member.kind === "property" && member.name === name,
  );
}

function cloneValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item));
  }
  if (isPlainObject(value)) {
    const copy: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      copy[key] = cloneValue(item);
    }
    return copy;
  }
  return value;
}
