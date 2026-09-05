import type { BomDocument, BlockDefinition } from "@blockml/bom";
import { isNodeModulesPath } from "./package-paths.js";

function documentSourcePath(document: BomDocument): string {
  return document.source?.filePath || document.block.source?.file || "";
}

/** Keep a workspace entry when the incoming file is an npm copy of the same FQN. */
function keepExisting(existing: BomDocument, incoming: BomDocument): boolean {
  return (
    isNodeModulesPath(documentSourcePath(incoming)) &&
    !isNodeModulesPath(documentSourcePath(existing))
  );
}

export class TypeRegistry {
  private readonly byFqn = new Map<string, BomDocument>();

  register(document: BomDocument): void {
    this.registerBlock(document, document.block);
  }

  /**
   * Copy with `document` registered (open-buffer overlay). Does not mutate this.
   * Workspace-vs-npm priority still applies on the copy.
   */
  withOverlay(document: BomDocument): TypeRegistry {
    const next = new TypeRegistry();
    for (const [fqn, doc] of this.byFqn) {
      next.byFqn.set(fqn, doc);
    }
    next.register(document);
    return next;
  }

  private registerBlock(document: BomDocument, block: BlockDefinition): void {
    if (block.type) {
      const existing = this.byFqn.get(block.type);
      if (!existing || !keepExisting(existing, { ...document, block })) {
        this.byFqn.set(block.type, { ...document, block });
      }
    }
    for (const sub of block.subBlocks) {
      this.registerBlock(document, sub);
    }
  }

  get(fqn: string): BomDocument | undefined {
    return this.byFqn.get(fqn);
  }

  has(fqn: string): boolean {
    return this.byFqn.has(fqn);
  }

  keys(): string[] {
    return [...this.byFqn.keys()];
  }

  size(): number {
    return this.byFqn.size;
  }
}
