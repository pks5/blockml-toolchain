import type {
  BlockDefinition,
  BlockInstance,
  CompositionNode,
  CompositionTemplate,
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
import { TransformError } from "./errors.js";
import {
  buildBlockEvaluationScope,
  closeMemberValue,
} from "./interpolate.js";
import {
  BOOLEAN_TYPE_FQN,
  EMPTY_STRUCT_FQN,
  INTEGER_TYPE_FQN,
  isPlainObject,
  MODEL_TRANSFORMATION_FQN,
  NUMBER_TYPE_FQN,
  STRUCT_TYPE_FQN,
  TEXT_TYPE_FQN,
} from "./constants.js";
import {
  clearProperty,
  getParameterMappings,
  getPropertyLiteral,
  setOverrideProperty,
  setParameterMappings,
} from "./properties.js";
import { lookupReferencedProperty, propertyLiteral } from "./property-reference.js";
import {
  parseModelPath,
  readPath,
  ResultResolutionError,
  typeFromExpression,
  walkType,
  writePath,
  type ResolvedType,
} from "./result.js";

export class ParametersResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParametersResolutionError";
  }
}

export {
  EMPTY_STRUCT_FQN,
  NUMBER_TYPE_FQN,
  STRUCT_TYPE_FQN,
  isPlainObject,
} from "./constants.js";
export const PRIMITIVE_TYPE_FQN = "org.blockml.bml.type.PrimitiveType";

export function parseParametersJson(raw: string | undefined): unknown {
  if (raw === undefined) {
    return undefined;
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new TransformError("resolve", "Invalid --parameters JSON");
  }
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

export function pendingParametersValue(block: BlockDefinition): unknown {
  return getPropertyLiteral(block, "parameters");
}

export function resolveParametersTypeFqn(block: BlockDefinition): string {
  return resolveParametersType(block).fqn;
}

export function resolveParametersType(block: BlockDefinition): ResolvedType {
  const arg = parametersTypeArgument(block.baseTypeExpression);
  if (arg) {
    return typeFromExpression(arg);
  }
  return { fqn: TEXT_TYPE_FQN, array: false };
}

export function isEmptyParameterValue(value: unknown): boolean {
  if (value === undefined) {
    return true;
  }
  if (value === "") {
    return true;
  }
  return isPlainObject(value) && Object.keys(value).length === 0;
}

function parametersTypeArgument(
  expr: TypeExpression | undefined,
): TypeExpression | undefined {
  if (expr?.kind !== "named" || expr.fqn !== MODEL_TRANSFORMATION_FQN) {
    return undefined;
  }
  return expr.typeArguments?.[0];
}

export function assertParametersCompatible(
  value: Record<string, unknown>,
  typeFqn: string,
  registry: TypeRegistry,
  path = "parameters",
): void {
  assertValueCompatible(value, typeFqn, registry, path);
}

export function assertCompatibleValue(
  value: unknown,
  typeFqn: string,
  registry: TypeRegistry,
  path: string,
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

export interface ParameterMappingSpec {
  source: string;
  sourcePath?: string;
  parameterPath?: string;
}

export interface ParameterApplyOptions {
  parameters?: unknown;
  parameterMappings?: readonly ParameterMappingSpec[];
}

export function parseParameterMappingsJson(
  raw: string | undefined,
): ParameterMappingSpec[] | undefined {
  if (raw === undefined) {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new TransformError("resolve", "Invalid --parameter-mappings JSON");
  }
  if (!Array.isArray(parsed)) {
    throw new TransformError("resolve", "--parameter-mappings must be a JSON array");
  }
  return parsed.map((item, index) => {
    if (!isPlainObject(item)) {
      throw new TransformError(
        "resolve",
        `--parameter-mappings[${index}] must be an object`,
      );
    }
    if (typeof item.source !== "string" || item.source.trim() === "") {
      throw new TransformError(
        "resolve",
        `--parameter-mappings[${index}].source is required`,
      );
    }
    const mapping: ParameterMappingSpec = { source: item.source.trim() };
    if (typeof item.sourcePath === "string" && item.sourcePath.trim() !== "") {
      mapping.sourcePath = item.sourcePath.trim();
    }
    if (typeof item.parameterPath === "string" && item.parameterPath.trim() !== "") {
      mapping.parameterPath = item.parameterPath.trim();
    }
    return mapping;
  });
}

function isStructParametersType(typeFqn: string, registry: TypeRegistry): boolean {
  return extendsType(typeFqn, STRUCT_TYPE_FQN, registry) || typeFqn === EMPTY_STRUCT_FQN;
}

function effectiveCliMappings(
  mappings: readonly ParameterMappingSpec[] | undefined,
): ParameterMappingSpec[] | undefined {
  if (!mappings || mappings.length === 0) {
    return undefined;
  }
  return [...mappings];
}

export function applyExecutionParameters(
  block: BlockDefinition,
  registry: TypeRegistry,
  options: ParameterApplyOptions = {},
): unknown {
  const typeFqn = resolveParametersTypeFqn(block);
  const cliMappings = effectiveCliMappings(options.parameterMappings);
  if (cliMappings) {
    setParameterMappings(block, cliMappings);
  }

  const mappings = getParameterMappings(block);
  let value: unknown;
  if (mappings.length > 0) {
    applyParameterMappings(block, registry);
    value = pendingParametersValue(block);
  } else if (options.parameters === undefined) {
    value = pendingParametersValue(block);
  } else if (isStructParametersType(typeFqn, registry)) {
    if (!isPlainObject(options.parameters)) {
      throw new TransformError("resolve", "parameters must be an object");
    }
    const pending = pendingParametersValue(block);
    if (pending !== undefined && !isPlainObject(pending)) {
      throw new TransformError(
        "resolve",
        "pending parameters must be a JSON object",
      );
    }
    value = deepMergeParameters(
      pending === undefined ? {} : pending,
      options.parameters,
    );
  } else {
    value = options.parameters;
  }

  if (isEmptyParameterValue(value)) {
    clearProperty(block, "parameters");
    return undefined;
  }
  if (mappings.length === 0) {
    assertCompatibleValue(value, typeFqn, registry, "parameters");
    setOverrideProperty(block, "parameters", typeFqn, value);
  }
  return value;
}

function applyParameterMappings(
  block: BlockDefinition,
  registry: TypeRegistry,
): void {
  const mappings = getParameterMappings(block);
  const parametersType = resolveParametersType(block);
  for (const mapping of mappings) {
    applyOneParameterMapping(block, mapping, parametersType, registry);
  }
}

function applyOneParameterMapping(
  block: BlockDefinition,
  mapping: BlockInstance,
  parametersType: ResolvedType,
  registry: TypeRegistry,
): void {
  let raw: string;
  try {
    raw = closeMappingSource(block, mapping.memberValues.source);
  } catch (error) {
    if (error instanceof ExpressionEvaluationError) {
      throw new ParametersResolutionError(error.message);
    }
    throw error;
  }

  const lookedUp = lookupReferencedProperty(raw, registry, "source");
  if ("error" in lookedUp) {
    throw new ParametersResolutionError(lookedUp.error);
  }

  let sourcePath;
  let parameterPath;
  try {
    sourcePath = parseModelPath(mappingText(mapping, "sourcePath"), "sourcePath");
    parameterPath = parseModelPath(mappingText(mapping, "parameterPath"), "parameterPath");
  } catch (error) {
    throw wrapMappingError(error);
  }

  let selectedType;
  let selectedValue;
  try {
    selectedType = walkType(
      typeFromPropertyLike(lookedUp.property),
      sourcePath,
      registry,
      "sourcePath",
    );
    const sourceValue = propertyLiteral(lookedUp.property);
    if (sourceValue === undefined) {
      throw new ParametersResolutionError(
        `source property ${lookedUp.blockFqn}.properties.${lookedUp.propertyName} has no value`,
      );
    }
    selectedValue = readPath(sourceValue, sourcePath, "sourcePath");
  } catch (error) {
    throw wrapMappingError(error);
  }

  if (parameterPath.length === 0) {
    if (!typesEqual(selectedType, parametersType)) {
      throw new ParametersResolutionError(
        `source type ${formatType(selectedType)} does not match parameters type ${formatType(parametersType)}`,
      );
    }
    setOverrideProperty(block, "parameters", parametersType.fqn, selectedValue);
    return;
  }

  let targetType;
  let next;
  try {
    targetType = walkType(parametersType, parameterPath, registry, "parameterPath");
    if (!typesEqual(selectedType, targetType)) {
      throw new ParametersResolutionError(
        `source type ${formatType(selectedType)} does not match parameter path type ${formatType(targetType)}`,
      );
    }
    const current = getPropertyLiteral(block, "parameters");
    next = writePath(
      current,
      parameterPath,
      selectedValue,
      parametersType,
      registry,
      "parameterPath",
    );
  } catch (error) {
    throw wrapMappingError(error);
  }
  setOverrideProperty(block, "parameters", parametersType.fqn, next);
}

function closeMappingSource(
  block: BlockDefinition,
  value: MemberValue | undefined,
): string {
  if (!value) {
    throw new ParametersResolutionError("source is required");
  }
  const closed = closeMemberValue(value, buildBlockEvaluationScope(block));
  if (closed.kind !== "literal" || typeof closed.value !== "string") {
    throw new ParametersResolutionError("source must close to a PropertyIdentifier path");
  }
  const trimmed = closed.value.trim();
  if (trimmed === "") {
    throw new ParametersResolutionError("source is required");
  }
  return trimmed;
}

function mappingText(
  mapping: BlockInstance,
  name: string,
): string | undefined {
  const value = mapping.memberValues[name];
  if (!value) {
    return undefined;
  }
  if (value.kind === "literal" && typeof value.value === "string") {
    const trimmed = value.value.trim();
    return trimmed === "" ? undefined : trimmed;
  }
  return undefined;
}

function typeFromPropertyLike(property: PropertyDefinition): ResolvedType {
  if (property.type) {
    const fromExpr = typeFromExpression(property.type);
    if (!fromExpr.fqn && property.typeFqn) {
      return { fqn: property.typeFqn, array: fromExpr.array };
    }
    return fromExpr;
  }
  return { fqn: property.typeFqn ?? "", array: false };
}

function typesEqual(left: ResolvedType, right: ResolvedType): boolean {
  return left.fqn === right.fqn && left.array === right.array;
}

function formatType(type: ResolvedType): string {
  return type.array ? `${type.fqn}[]` : type.fqn;
}

function wrapMappingError(error: unknown): ParametersResolutionError {
  if (error instanceof ParametersResolutionError) {
    return error;
  }
  if (error instanceof ResultResolutionError) {
    return new ParametersResolutionError(error.message);
  }
  if (error instanceof Error) {
    return new ParametersResolutionError(error.message);
  }
  return new ParametersResolutionError(String(error));
}

/**
 * Rewrite FQNs rooted at this execution Block after a lifecycle relocate.
 * Covers SubBlocks, parameters and result property types, and composition
 * instances nested under a ModelOperation.
 */
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
  for (const sub of block.subBlocks ?? []) {
    sub.type = rewrite(sub.type);
    rewriteParameterTypeFqns(sub, fromFqn, toFqn);
  }
  for (const template of block.compositions ?? []) {
    rewriteCompositionTemplate(template, rewrite);
  }
  for (const member of block.members) {
    if (member.kind === "aggregation") {
      rewriteCompositionTemplate(member.composition, rewrite);
    }
    if (member.kind !== "property") {
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

function rewriteCompositionTemplate(
  template: CompositionTemplate | undefined,
  rewrite: (value: string) => string,
): void {
  if (!template) {
    return;
  }
  rewriteCompositionNodes(template.children, rewrite);
}

function rewriteCompositionNodes(
  nodes: CompositionNode[],
  rewrite: (value: string) => string,
): void {
  for (const node of nodes) {
    if (node.kind === "virtualContainer") {
      rewriteCompositionNodes(node.children, rewrite);
      continue;
    }
    node.instance.typeFqn = rewrite(node.instance.typeFqn);
    for (const agg of node.instance.aggregationCompositions ?? []) {
      rewriteCompositionTemplate(agg.composition, rewrite);
    }
  }
}
