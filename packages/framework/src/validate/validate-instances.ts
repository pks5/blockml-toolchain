import type {
  BlockDefinition,
  BlockInstance,
  BomDocument,
  CompositionNode,
  Diagnostic,
  MemberValue,
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

function validateInstanceSemantics(
  instance: BlockInstance,
  registry: TypeRegistry,
  file: string,
  diagnostics: Diagnostic[],
): void {
  if (!instance.typeFqn) {
    diagnostics.push(
      diag(
        "BML_UNKNOWN_TYPE",
        "Unknown type: (missing instance typeFqn)",
        file,
        instance.source?.line,
        instance.source?.column,
      ),
    );
    return;
  }
  const typeDoc = registry.get(instance.typeFqn);
  if (!typeDoc) {
    diagnostics.push(
      diag(
        "BML_UNKNOWN_TYPE",
        `Unknown type: ${instance.typeFqn}`,
        file,
        instance.source?.line,
        instance.source?.column,
      ),
    );
    return;
  }
  const effective = resolveEffectiveMembers(typeDoc.block, registry);
  const names = new Set(effective.map((m) => m.name));
  for (const key of Object.keys(instance.memberValues)) {
    if (!names.has(key)) {
      diagnostics.push(
        diag(
          "BML_UNKNOWN_PROPERTY",
          `Unknown property: ${key} on ${instance.typeFqn}`,
          file,
          instance.source?.line,
          instance.source?.column,
        ),
      );
    }
  }
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
  registry: TypeRegistry,
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
      validateInstanceSemantics(node.instance, registry, file, diagnostics);
      validateInstanceRefs(node.instance, ids, file, diagnostics);
      for (const agg of node.instance.aggregationCompositions ?? []) {
        validateCompositionNodes(agg.composition.children, ids, registry, file, diagnostics);
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
      validateCompositionNodes(node.children, ids, registry, file, diagnostics);
    }
  }
}

function walkBlockInstances(
  block: BlockDefinition,
  registry: TypeRegistry,
  file: string,
  ids: Map<string, { file: string; line?: number; column?: number }>,
  diagnostics: Diagnostic[],
): void {
  for (const template of block.compositions) {
    validateCompositionNodes(template.children, ids, registry, file, diagnostics);
  }
  for (const instance of block.constraints ?? []) {
    validateInstanceSemantics(instance, registry, file, diagnostics);
    validateInstanceRefs(instance, ids, file, diagnostics);
    for (const agg of instance.aggregationCompositions ?? []) {
      validateCompositionNodes(agg.composition.children, ids, registry, file, diagnostics);
    }
  }
  for (const member of block.members) {
    for (const instance of member.constraints ?? []) {
      validateInstanceSemantics(instance, registry, file, diagnostics);
      validateInstanceRefs(instance, ids, file, diagnostics);
    }
    if (member.kind === "property") {
      for (const instance of member.suggestions ?? []) {
        validateInstanceSemantics(instance, registry, file, diagnostics);
      }
    }
  }
  for (const sub of block.subBlocks) {
    walkBlockInstances(sub, registry, file, ids, diagnostics);
  }
  for (const embedded of block.embeddedBlocks) {
    walkBlockInstances(embedded, registry, file, ids, diagnostics);
  }
}

export function validateInstances(
  document: BomDocument,
  registry: TypeRegistry,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const file = document.source.filePath ?? "<memory>";
  const ids = collectDocumentInstanceIds(document.block, file);
  walkBlockInstances(document.block, registry, file, ids, diagnostics);
  return diagnostics;
}
