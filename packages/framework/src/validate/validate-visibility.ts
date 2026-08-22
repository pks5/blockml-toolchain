import type {
  BlockDefinition,
  BlockInstance,
  BomDocument,
  CompositionNode,
  Diagnostic,
  MemberDefinition,
} from "@blockml/bom";
import type { TypeRegistry } from "../registry/type-registry.js";
import { resolveEffectiveMembers } from "../resolve/resolve-effective-members.js";

function diag(
  code: string,
  message: string,
  file: string,
  line = 1,
  column = 1,
): Diagnostic {
  return { severity: "error", code, message, source: { file, line, column } };
}

function visibilityKey(member: MemberDefinition): string {
  const vis = member.visibility ?? "public";
  return `${member.name}:${vis}`;
}

function validateBlockVisibility(
  block: BlockDefinition,
  registry: TypeRegistry,
  file: string,
  diagnostics: Diagnostic[],
): void {
  const effective = resolveEffectiveMembers(block, registry);
  const seen = new Map<string, MemberDefinition>();
  for (const member of effective) {
    const key = visibilityKey(member);
    if (seen.has(key)) {
      diagnostics.push(
        diag(
          "BML_DUPLICATE_MEMBER_VISIBILITY_VARIANT",
          `Duplicate member visibility variant: ${key}`,
          file,
          member.source?.line,
          member.source?.column,
        ),
      );
      continue;
    }
    seen.set(key, member);

    if (member.visibility === "private" && member.override) {
      diagnostics.push(
        diag(
          "BML_VISIBILITY_PRIVATE_OVERRIDE",
          `Private member ${member.name} cannot override`,
          file,
          member.source?.line,
          member.source?.column,
        ),
      );
    }
  }

  for (const sub of block.subBlocks) {
    validateBlockVisibility(sub, registry, file, diagnostics);
  }
}

export function validateVisibility(
  document: BomDocument,
  registry: TypeRegistry,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const file = document.source.filePath ?? "<memory>";
  validateBlockVisibility(document.block, registry, file, diagnostics);
  return diagnostics;
}
