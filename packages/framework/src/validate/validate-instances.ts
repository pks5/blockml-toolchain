import type {
  BlockDefinition,
  BlockInstance,
  BomDocument,
  CompositionNode,
  CompositionTemplate,
  Diagnostic,
  MemberValue,
} from "@blockml/bom";
import type { TypeRegistry } from "../registry/type-registry.js";

function diag(
  code: string,
  message: string,
  file: string,
  line = 1,
  column = 1,
): Diagnostic {
  return { severity: "error", code, message, source: { file, line, column } };
}

function literalString(val: MemberValue | undefined): string | undefined {
  if (!val || val.kind !== "literal") {
    return undefined;
  }
  return typeof val.value === "string" ? val.value : String(val.value);
}

function instanceId(instance: BlockInstance): string | undefined {
  return literalString(instance.id);
}

function collectIdsInComposition(
  nodes: CompositionNode[],
  ids: Map<string, { file: string; line?: number; column?: number }>,
  file: string,
): void {
  for (const node of nodes) {
    if (node.kind === "blockInstance") {
      const id = instanceId(node.instance);
      if (id) {
        const loc: { file: string; line?: number; column?: number } = { file };
        if (node.instance.source?.line !== undefined) {
          loc.line = node.instance.source.line;
        }
        if (node.instance.source?.column !== undefined) {
          loc.column = node.instance.source.column;
        }
        ids.set(id, loc);
      }
      for (const agg of node.instance.aggregationCompositions ?? []) {
        collectIdsInComposition(agg.composition.children, ids, file);
      }
    } else {
      collectIdsInComposition(node.children, ids, file);
    }
  }
}

function collectDocumentInstanceIds(
  block: BlockDefinition,
  file: string,
): Map<string, { file: string; line?: number; column?: number }> {
  const ids = new Map<string, { file: string; line?: number; column?: number }>();
  for (const template of block.compositions) {
    collectIdsInComposition(template.children, ids, file);
  }
  for (const sub of block.subBlocks) {
    const subIds = collectDocumentInstanceIds(sub, file);
    for (const [id, loc] of subIds) {
      ids.set(id, loc);
    }
  }
  return ids;
}

function resolveInstanceRef(
  token: string,
  ids: Map<string, { file: string; line?: number; column?: number }>,
): boolean {
  if (token.includes("::")) {
    const id = token.split("::").pop();
    return id !== undefined && ids.has(id);
  }
  return ids.has(token);
}

function validateInstanceRefs(
  instance: BlockInstance,
  ids: Map<string, { file: string; line?: number; column?: number }>,
  file: string,
  diagnostics: Diagnostic[],
): void {
  if (instance.basePresets && !resolveInstanceRef(instance.basePresets, ids)) {
    diagnostics.push(
      diag(
        "BML_UNRESOLVABLE_INSTANCE_REF",
        `Unresolved basePresets reference: ${instance.basePresets}`,
        file,
        instance.source?.line,
        instance.source?.column,
      ),
    );
  }

  for (const val of Object.values(instance.memberValues)) {
    if (val.kind !== "literal") {
      continue;
    }
    const text = typeof val.value === "string" ? val.value : undefined;
    if (text && text.includes("::") && !resolveInstanceRef(text, ids)) {
      diagnostics.push(
        diag(
          "BML_UNRESOLVABLE_INSTANCE_REF",
          `Unresolved instance reference: ${text}`,
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
        validateInstanceRefs(child.instance, ids, file, diagnostics);
      }
    }
  }
}

function validateCompositionNodes(
  nodes: CompositionNode[],
  ids: Map<string, { file: string; line?: number; column?: number }>,
  file: string,
  diagnostics: Diagnostic[],
): void {
  for (const node of nodes) {
    if (node.kind === "blockInstance") {
      const hasEach = node.directives?.some((d) => d.type === "each");
      if (hasEach && !instanceId(node.instance)) {
        diagnostics.push(
          diag(
            "BML_MISSING_ID",
            "bml:each requires explicit bml:id on the block instance",
            file,
            node.source?.line ?? node.instance.source?.line,
            node.source?.column ?? node.instance.source?.column,
          ),
        );
      }
      validateInstanceRefs(node.instance, ids, file, diagnostics);
      for (const agg of node.instance.aggregationCompositions ?? []) {
        validateCompositionNodes(agg.composition.children, ids, file, diagnostics);
      }
    } else {
      const hasEach = node.directives?.some((d) => d.type === "each");
      if (hasEach) {
        diagnostics.push(
          diag(
            "BML_MISSING_ID",
            "bml:each requires explicit bml:id on the container element",
            file,
            node.source?.line,
            node.source?.column,
          ),
        );
      }
      validateCompositionNodes(node.children, ids, file, diagnostics);
    }
  }
}

export function validateInstances(
  document: BomDocument,
  _registry: TypeRegistry,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const file = document.source.filePath ?? "<memory>";
  const ids = collectDocumentInstanceIds(document.block, file);
  for (const template of document.block.compositions) {
    validateCompositionNodes(template.children, ids, file, diagnostics);
  }
  return diagnostics;
}
