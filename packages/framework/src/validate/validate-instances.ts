import type {
  BlockDefinition,
  BlockInstance,
  BomDocument,
  CompositionNode,
  Diagnostic,
} from "@blockml/bom";
import type { TypeRegistry } from "../registry/type-registry.js";
import { resolveEffectiveMembers } from "../resolve/resolve-effective-members.js";
import {
  collectDocumentInstanceIds,
  instanceId,
  resolveInstanceRef,
  type InstanceIdLoc,
} from "./instance-ids.js";

function diag(
  code: string,
  message: string,
  file: string,
  line = 1,
  column = 1,
): Diagnostic {
  return { severity: "error", code, message, source: { file, line, column } };
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
  ids: Map<string, InstanceIdLoc>,
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
  ids: Map<string, InstanceIdLoc>,
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
  ids: Map<string, InstanceIdLoc>,
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
