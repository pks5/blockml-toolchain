import type {
  BlockDefinition,
  BlockInstance,
  BomDocument,
  CompositionNode,
  Diagnostic,
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

function readOnlyMemberNames(
  typeFqn: string,
  registry: TypeRegistry,
): Set<string> {
  const doc = registry.get(typeFqn);
  if (!doc) {
    return new Set();
  }
  return new Set(
    resolveEffectiveMembers(doc.block, registry)
      .filter((m) => m.readOnly)
      .map((m) => m.name),
  );
}

function validateInstanceReadOnly(
  instance: BlockInstance,
  registry: TypeRegistry,
  file: string,
  diagnostics: Diagnostic[],
): void {
  const readOnly = readOnlyMemberNames(instance.typeFqn, registry);
  for (const name of Object.keys(instance.memberValues)) {
    if (readOnly.has(name)) {
      diagnostics.push(
        diag(
          "BML_READONLY_MEMBER_WRITE",
          `readOnly member ${name} must not be set on block instance`,
          file,
          instance.source?.line,
          instance.source?.column,
        ),
      );
    }
  }
  for (const agg of instance.aggregationCompositions ?? []) {
    for (const child of agg.composition.children) {
      if (child.kind === "blockInstance") {
        validateInstanceReadOnly(child.instance, registry, file, diagnostics);
      }
    }
  }
}

function walkCompositionReadOnly(
  nodes: CompositionNode[],
  registry: TypeRegistry,
  file: string,
  diagnostics: Diagnostic[],
): void {
  for (const node of nodes) {
    if (node.kind === "blockInstance") {
      validateInstanceReadOnly(node.instance, registry, file, diagnostics);
      for (const agg of node.instance.aggregationCompositions ?? []) {
        walkCompositionReadOnly(agg.composition.children, registry, file, diagnostics);
      }
    } else {
      walkCompositionReadOnly(node.children, registry, file, diagnostics);
    }
  }
}

function validateBlockConstraintInstances(
  block: BlockDefinition,
  registry: TypeRegistry,
  file: string,
  diagnostics: Diagnostic[],
): void {
  for (const inst of block.constraints ?? []) {
    validateInstanceReadOnly(inst, registry, file, diagnostics);
  }
  for (const member of block.members) {
    for (const inst of member.constraints ?? []) {
      validateInstanceReadOnly(inst, registry, file, diagnostics);
    }
  }
  for (const sub of block.subBlocks) {
    validateBlockConstraintInstances(sub, registry, file, diagnostics);
  }
}

export function validateReadOnly(
  document: BomDocument,
  registry: TypeRegistry,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const file = document.source.filePath ?? "<memory>";
  for (const template of document.block.compositions) {
    walkCompositionReadOnly(template.children, registry, file, diagnostics);
  }
  validateBlockConstraintInstances(document.block, registry, file, diagnostics);
  return diagnostics;
}
