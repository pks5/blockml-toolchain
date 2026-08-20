import type { BlockDefinition } from "@blockml/bom";

export function cloneBlockDefinition(block: BlockDefinition): BlockDefinition {
  return structuredClone(block);
}
