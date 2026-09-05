import type { BlockDefinition, BlockInstance, CompositionNode, MemberValue } from "@blockml/bom";

export type InstanceIdLoc = { file: string; line?: number; column?: number };

function literalString(val: MemberValue | undefined): string | undefined {
  if (!val || val.kind !== "literal") {
    return undefined;
  }
  return typeof val.value === "string" ? val.value : String(val.value);
}

export function instanceId(instance: BlockInstance): string | undefined {
  return literalString(instance.id);
}

function collectIdsInComposition(
  nodes: CompositionNode[],
  ids: Map<string, InstanceIdLoc>,
  file: string,
): void {
  for (const node of nodes) {
    if (node.kind === "blockInstance") {
      const id = instanceId(node.instance);
      if (id) {
        const loc: InstanceIdLoc = { file };
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

export function collectDocumentInstanceIds(
  block: BlockDefinition,
  file: string,
): Map<string, InstanceIdLoc> {
  const ids = new Map<string, InstanceIdLoc>();
  for (const template of block.compositions) {
    collectIdsInComposition(template.children, ids, file);
  }
  for (const sub of block.subBlocks) {
    for (const [id, loc] of collectDocumentInstanceIds(sub, file)) {
      ids.set(id, loc);
    }
  }
  for (const embedded of block.embeddedBlocks) {
    for (const [id, loc] of collectDocumentInstanceIds(embedded, file)) {
      ids.set(id, loc);
    }
  }
  return ids;
}

export function resolveInstanceRef(
  token: string,
  ids: Map<string, InstanceIdLoc>,
): boolean {
  if (token.includes("::")) {
    const id = token.split("::").pop();
    return id !== undefined && ids.has(id);
  }
  return ids.has(token);
}
