import type {
  BlockDefinition,
  BlockInstance,
  BomDocument,
  Diagnostic,
  ExpressionValue,
  LiteralValue,
  MemberDefinition,
  MemberValue,
  PropertyDefinition,
} from "@blockml/bom";
import type { TypeRegistry } from "../registry/type-registry.js";
import { parseExpression } from "../expression/parse-expression.js";
import {
  memberIdentityKey,
  resolveEffectiveMembers,
} from "../resolve/resolve-effective-members.js";

function diag(
  code: string,
  message: string,
  file: string,
  line = 1,
  column = 1,
): Diagnostic {
  return { severity: "error", code, message, source: { file, line, column } };
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
        block.source?.line,
        block.source?.column,
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
          block.source?.line,
          block.source?.column,
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
          member.source?.line,
          member.source?.column,
        ),
      );
    }
    seen.add(key);
  }

  for (const member of block.members) {
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
            member.source?.line,
            member.source?.column,
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
            member.source?.line,
            member.source?.column,
          ),
        );
      }
    }

    if (member.kind === "property") {
      validatePropertyExpressions(member, file, diagnostics);
    }
  }

  for (const sub of block.subBlocks) {
    validateBlockDefinition(sub, registry, file, diagnostics);
  }
}

function validatePropertyExpressions(
  prop: PropertyDefinition,
  file: string,
  diagnostics: Diagnostic[],
): void {
  const checkVal = (val: MemberValue | undefined, label: string) => {
    if (!val || val.kind !== "expression") {
      return;
    }
    const expr = val as ExpressionValue;
    const parsed = parseExpression(expr.raw);
    if (!parsed.ok) {
      diagnostics.push(
        diag(
          "BML_EXPRESSION_PARSE_ERROR",
          `${label}: ${parsed.error.message}`,
          file,
          expr.source?.line,
          expr.source?.column,
        ),
      );
    }
  };
  checkVal(prop.value, prop.name);
  for (const entry of prop.values ?? []) {
    checkVal(entry.value, prop.name);
  }
}

function validateInstanceExpressions(
  instance: BlockInstance,
  file: string,
  diagnostics: Diagnostic[],
): void {
  for (const [name, val] of Object.entries(instance.memberValues)) {
    if (val.kind === "expression") {
      const parsed = parseExpression(val.raw);
      if (!parsed.ok) {
        diagnostics.push(
          diag(
            "BML_EXPRESSION_PARSE_ERROR",
            `${name}: ${parsed.error.message}`,
            file,
            val.source?.line,
            val.source?.column,
          ),
        );
      }
    }
  }
}

function walkCompositions(block: BlockDefinition, file: string, diagnostics: Diagnostic[]): void {
  for (const template of block.compositions) {
    for (const child of template.children) {
      if (child.kind === "blockInstance") {
        validateInstanceExpressions(child.instance, file, diagnostics);
      } else {
        for (const nested of child.children) {
          if (nested.kind === "blockInstance") {
            validateInstanceExpressions(nested.instance, file, diagnostics);
          }
        }
      }
    }
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
  walkCompositions(document.block, file, diagnostics);

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
