import type {
  BlockDefinition,
  BlockInstance,
  BomDocument,
  CompositionNode,
  Diagnostic,
  ExpressionValue,
  InterpolatedTextValue,
  LiteralValue,
  MemberDefinition,
  MemberValue,
  PropertyDefinition,
  SourceLocation,
  TypeExpression,
} from "@blockml/bom";
import type { TypeRegistry } from "../registry/type-registry.js";
import { parseExpression } from "../expression/parse-expression.js";
import { parseInterpolatedText } from "../expression/parse-interpolated-text.js";
import { INTERPOLATION_NOT_ALLOWED } from "../expression/restricted.js";
import {
  memberIdentityKey,
  resolveEffectiveMembers,
} from "../resolve/resolve-effective-members.js";
import { satisfiesTypeBound } from "../resolve/satisfies-type-bound.js";
import { isWellKnownTypeFqn } from "@blockml/parser";

const TEXT_TYPE_FQN = "org.blockml.bml.type.Text";

function containsUnescapedInterpolation(raw: string): boolean {
  for (let i = 0; i < raw.length - 1; i++) {
    if (raw[i] === "$" && raw[i + 1] === "{") {
      if (i === 0 || raw[i - 1] !== "\\") {
        return true;
      }
    }
  }
  return false;
}

function namedTypeFqn(expr: TypeExpression | undefined, fallback?: string): string | undefined {
  if (expr?.kind === "named") {
    return expr.fqn;
  }
  if (expr?.kind === "grouped") {
    return namedTypeFqn(expr.expression, fallback);
  }
  return fallback;
}

function isTextType(expr: TypeExpression | undefined, fallback?: string): boolean {
  return namedTypeFqn(expr, fallback) === TEXT_TYPE_FQN && !hasMultiplicity(expr);
}

function isTextListType(expr: TypeExpression | undefined, fallback?: string): boolean {
  if (namedTypeFqn(expr, fallback) !== TEXT_TYPE_FQN) {
    return false;
  }
  return hasMultiplicity(expr);
}

function hasMultiplicity(expr: TypeExpression | undefined): boolean {
  if (!expr) {
    return false;
  }
  if (expr.kind === "named" || expr.kind === "grouped") {
    return expr.multiplicity !== undefined;
  }
  return false;
}

function diag(
  code: string,
  message: string,
  file: string,
  loc?: Pick<SourceLocation, "line" | "column" | "endLine" | "endColumn" | "file">,
): Diagnostic {
  const source: SourceLocation = {
    file: loc?.file ?? file,
    line: loc?.line ?? 1,
    column: loc?.column ?? 1,
  };
  if (loc?.endLine !== undefined) {
    source.endLine = loc.endLine;
  }
  if (loc?.endColumn !== undefined) {
    source.endColumn = loc.endColumn;
  }
  return { severity: "error", code, message, source };
}

function typeIsKnown(fqn: string, registry: TypeRegistry): boolean {
  return registry.has(fqn) || isWellKnownTypeFqn(fqn);
}

const CORE_EXCEPTION = "org.blockml.bml.core.Exception";

function walkNamedTypes(expr: TypeExpression | undefined, visit: (fqn: string) => void): void {
  if (!expr) {
    return;
  }
  switch (expr.kind) {
    case "named":
      visit(expr.fqn);
      for (const arg of expr.typeArguments ?? []) {
        walkNamedTypes(arg, visit);
      }
      break;
    case "union":
      for (const alt of expr.alternatives) {
        walkNamedTypes(alt, visit);
      }
      break;
    case "grouped":
      walkNamedTypes(expr.expression, visit);
      break;
    case "anonymousStruct":
      for (const field of expr.fields) {
        walkNamedTypes(field.type, visit);
      }
      break;
    default:
      break;
  }
}

function validateMemberTypes(
  member: MemberDefinition,
  registry: TypeRegistry,
  file: string,
  diagnostics: Diagnostic[],
): void {
  const loc = member.typeSource ?? member.source;
  const report = (fqn: string) => {
    if (!typeIsKnown(fqn, registry)) {
      diagnostics.push(diag("BML_UNKNOWN_TYPE", `Unknown type: ${fqn}`, file, loc));
    }
  };

  if (member.kind === "property") {
    if (member.type) {
      walkNamedTypes(member.type, report);
    } else if (member.typeFqn) {
      report(member.typeFqn);
    }
  } else if (member.kind === "aggregation" || member.kind === "association") {
    walkNamedTypes(member.type, report);
  } else if (member.kind === "capability") {
    if (member.typeFqn) {
      report(member.typeFqn);
    }
    walkNamedTypes(member.inputType, (fqn) => {
      if (!typeIsKnown(fqn, registry)) {
        diagnostics.push(
          diag("BML_UNKNOWN_TYPE", `Unknown type: ${fqn}`, file, member.inputTypeSource ?? loc),
        );
      }
    });
    walkNamedTypes(member.outputType, (fqn) => {
      if (!typeIsKnown(fqn, registry)) {
        diagnostics.push(
          diag("BML_UNKNOWN_TYPE", `Unknown type: ${fqn}`, file, member.outputTypeSource ?? loc),
        );
      }
    });
    for (const thrown of member.throws ?? []) {
      const fqn = thrown.value;
      if (!typeIsKnown(fqn, registry)) {
        diagnostics.push(diag("BML_UNKNOWN_TYPE", `Unknown type: ${fqn}`, file, loc));
        continue;
      }
      if (!satisfiesTypeBound(fqn, CORE_EXCEPTION, registry)) {
        diagnostics.push(
          diag(
            "BML_TYPE_BOUND_NOT_SATISFIED",
            `Type ${fqn} does not satisfy bound ${CORE_EXCEPTION}`,
            file,
            loc,
          ),
        );
      }
    }
  }
}

function literalNumber(val: MemberValue | undefined): number | undefined {
  if (!val || val.kind !== "literal") {
    return undefined;
  }
  return typeof val.value === "number" ? val.value : undefined;
}

function validateBlockDefinition(
  block: BlockDefinition,
  registry: TypeRegistry,
  file: string,
  diagnostics: Diagnostic[],
): void {
  if (block.baseType && !registry.has(block.baseType)) {
    diagnostics.push(
      diag(
        "BML_UNKNOWN_BASE_TYPE",
        `Unknown baseType: ${block.baseType}`,
        file,
        block.baseTypeSource ?? block.source,
      ),
    );
  }

  for (const ref of block.contracts ?? []) {
    if (!registry.has(ref.value)) {
      diagnostics.push(
        diag(
          "BML_UNKNOWN_CONTRACT",
          `Unknown contract: ${ref.value}`,
          file,
          block.source,
        ),
      );
    }
  }

  const effective = resolveEffectiveMembers(block, registry);
  const seen = new Set<string>();
  for (const member of effective) {
    const key = memberIdentityKey(member);
    if (seen.has(key)) {
      diagnostics.push(
        diag(
          "BML_MEMBER_COLLISION",
          `Duplicate effective member identity: ${key}`,
          file,
          member.source,
        ),
      );
    }
    seen.add(key);
  }

  for (const member of block.members) {
    validateMemberTypes(member, registry, file, diagnostics);
    const skipOverrideCheck =
      member.kind === "aggregation" &&
      (member.composition !== undefined || member.default === true);

    if (member.override) {
      const parentBlock = block.baseType ? registry.get(block.baseType)?.block : undefined;
      const parentMembers = parentBlock
        ? resolveEffectiveMembers(parentBlock, registry)
        : [];
      const hasParent = parentMembers.some(
        (m) =>
          memberIdentityKey(m) === memberIdentityKey(member) && m.kind === member.kind,
      );
      if (block.baseType && registry.has(block.baseType) && !hasParent) {
        diagnostics.push(
          diag(
            "BML_OVERRIDE_WITHOUT_PARENT",
            `override without parent member: ${member.name}`,
            file,
            member.source,
          ),
        );
      }
    } else if (block.baseType && registry.has(block.baseType) && !skipOverrideCheck) {
      const parentBlock = registry.get(block.baseType)?.block;
      const parentDirect = parentBlock?.members ?? [];
      const hasParent = parentDirect.some(
        (m) =>
          memberIdentityKey(m) === memberIdentityKey(member) && m.kind === member.kind,
      );
      if (hasParent && !member.override) {
        diagnostics.push(
          diag(
            "BML_OVERRIDE_REQUIRED",
            `override required for redeclared member: ${member.name}`,
            file,
            member.source,
          ),
        );
      }
    }

    if (member.kind === "property") {
      validatePropertyExpressions(member, file, diagnostics);
    }
    if (member.kind === "aggregation" && member.composition) {
      walkCompositionNodes(member.composition.children, registry, file, diagnostics);
    }
  }

  for (const sub of block.subBlocks) {
    validateBlockDefinition(sub, registry, file, diagnostics);
  }
}

function interpolationParseCode(message: string): string {
  if (message === INTERPOLATION_NOT_ALLOWED) {
    return "BML_EXPR_NOT_ALLOWED_IN_INTERPOLATION";
  }
  if (message === "Unclosed interpolation") {
    return "BML_EXPR_SYNTAX_ERROR";
  }
  return "BML_EXPRESSION_PARSE_ERROR";
}

function validateInterpolatedRaw(
  raw: string,
  label: string,
  file: string,
  diagnostics: Diagnostic[],
  loc?: SourceLocation,
): void {
  const parsed = parseInterpolatedText(raw);
  if (!parsed.ok) {
    diagnostics.push(
      diag(interpolationParseCode(parsed.error.message), `${label}: ${parsed.error.message}`, file, loc),
    );
  }
}

function validateTextListLeaves(
  value: unknown,
  label: string,
  file: string,
  diagnostics: Diagnostic[],
  loc?: SourceLocation,
): void {
  if (!Array.isArray(value)) {
    return;
  }
  for (const item of value) {
    if (typeof item === "string" && containsUnescapedInterpolation(item)) {
      validateInterpolatedRaw(item, label, file, diagnostics, loc);
    }
  }
}

function validateMemberValueExpressions(
  val: MemberValue | undefined,
  label: string,
  file: string,
  diagnostics: Diagnostic[],
  type: TypeExpression | undefined,
  typeFqn?: string,
): void {
  if (!val) {
    return;
  }
  if (val.kind === "expression") {
    const expr = val as ExpressionValue;
    const parsed = parseExpression(expr.raw);
    if (!parsed.ok) {
      diagnostics.push(
        diag(
          "BML_EXPRESSION_PARSE_ERROR",
          `${label}: ${parsed.error.message}`,
          file,
          expr.source,
        ),
      );
    }
    return;
  }
  if (val.kind === "interpolated") {
    const interpolated = val as InterpolatedTextValue;
    if (type !== undefined || typeFqn !== undefined) {
      if (!isTextType(type, typeFqn)) {
        diagnostics.push(
          diag(
            "BML_EXPR_TYPE_MISMATCH",
            `${label}: interpolated text is only allowed on type:Text`,
            file,
            interpolated.source,
          ),
        );
        return;
      }
    }
    validateInterpolatedRaw(interpolated.raw, label, file, diagnostics, interpolated.source);
    return;
  }
  if (val.kind === "literal" && isTextListType(type, typeFqn)) {
    validateTextListLeaves(val.value, label, file, diagnostics);
  }
}

function validatePropertyExpressions(
  prop: PropertyDefinition,
  file: string,
  diagnostics: Diagnostic[],
): void {
  const checkVal = (val: MemberValue | undefined) => {
    validateMemberValueExpressions(val, prop.name, file, diagnostics, prop.type, prop.typeFqn);
  };
  checkVal(prop.value);
  for (const entry of prop.values ?? []) {
    checkVal(entry.value);
  }
}

function validateInstanceExpressions(
  instance: BlockInstance,
  registry: TypeRegistry,
  file: string,
  diagnostics: Diagnostic[],
): void {
  const typeBlock = registry.get(instance.typeFqn)?.block;
  const members = typeBlock ? resolveEffectiveMembers(typeBlock, registry) : [];
  for (const [name, val] of Object.entries(instance.memberValues)) {
    const prop = members.find(
      (member): member is PropertyDefinition =>
        member.kind === "property" && member.name === name,
    );
    validateMemberValueExpressions(val, name, file, diagnostics, prop?.type, prop?.typeFqn);
  }
}

function walkCompositionNodes(
  nodes: CompositionNode[],
  registry: TypeRegistry,
  file: string,
  diagnostics: Diagnostic[],
): void {
  for (const child of nodes) {
    if (child.kind === "blockInstance") {
      validateInstanceExpressions(child.instance, registry, file, diagnostics);
      for (const agg of child.instance.aggregationCompositions ?? []) {
        walkCompositionNodes(agg.composition.children, registry, file, diagnostics);
      }
    } else {
      walkCompositionNodes(child.children, registry, file, diagnostics);
    }
  }
}

function walkCompositions(
  block: BlockDefinition,
  registry: TypeRegistry,
  file: string,
  diagnostics: Diagnostic[],
): void {
  for (const template of block.compositions) {
    walkCompositionNodes(template.children, registry, file, diagnostics);
  }
}

export function validateTypes(
  document: BomDocument,
  registry: TypeRegistry,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const file = document.source.filePath ?? "<memory>";

  if (document.block.type && !registry.has(document.block.type)) {
    registry.register(document);
  }

  validateBlockDefinition(document.block, registry, file, diagnostics);
  walkCompositions(document.block, registry, file, diagnostics);

  return diagnostics;
}

export function getLiteralNumericValue(val: MemberValue | undefined): number | undefined {
  return literalNumber(val);
}

export function getPropertyNumericValue(prop: PropertyDefinition): number | undefined {
  const fromValue = literalNumber(prop.value);
  if (fromValue !== undefined) {
    return fromValue;
  }
  for (const entry of prop.values ?? []) {
    const n = literalNumber(entry.value);
    if (n !== undefined) {
      return n;
    }
  }
  return undefined;
}

export function isLiteralValue(val: MemberValue | undefined): val is LiteralValue {
  return val?.kind === "literal";
}
