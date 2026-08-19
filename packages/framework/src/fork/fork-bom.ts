import type { BomDocument } from "@blockml/bom";

/** Deep-clone Urmodell for pragmatic / validation working copy. */
export function forkBom(document: BomDocument): BomDocument {
  return structuredClone(document);
}
