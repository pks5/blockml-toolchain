import type { BomDocument, BlockDefinition } from "@blockml/bom";

export class TypeRegistry {
  private readonly byFqn = new Map<string, BomDocument>();

  register(document: BomDocument): void {
    this.registerBlock(document, document.block);
  }

  private registerBlock(document: BomDocument, block: BlockDefinition): void {
    if (block.type) {
      this.byFqn.set(block.type, { ...document, block });
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
