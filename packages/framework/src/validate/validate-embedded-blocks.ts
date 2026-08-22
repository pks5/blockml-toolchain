import type { BlockDefinition, BomDocument, Diagnostic } from "@blockml/bom";

function diag(
  code: string,
  message: string,
  file: string,
  line = 1,
  column = 1,
): Diagnostic {
  return { severity: "error", code, message, source: { file, line, column } };
}

function expectedSubBlockType(parentType: string, subName: string): string {
  return `${parentType}.${subName}`;
}

function validateSubBlocks(
  block: BlockDefinition,
  file: string,
  diagnostics: Diagnostic[],
): void {
  for (const sub of block.subBlocks) {
    if (sub.embeddedBlocks.length > 0) {
      diagnostics.push(
        diag(
          "BML_EMBEDDED_BLOCKS_ON_SUBBLOCK",
          `Sub-block ${sub.name} must not declare embeddedBlocks`,
          file,
          sub.source?.line,
          sub.source?.column,
        ),
      );
    }

    const expected = expectedSubBlockType(block.type, sub.name);
    if (sub.type && sub.type !== expected) {
      diagnostics.push(
        diag(
          "BML_SUBBLOCK_TYPE_MISMATCH",
          `Sub-block ${sub.name} type ${sub.type} does not match expected ${expected}`,
          file,
          sub.source?.line,
          sub.source?.column,
        ),
      );
    }

    validateSubBlocks(sub, file, diagnostics);
  }
}

function validateEmbeddedBlocksOnRoot(
  block: BlockDefinition,
  file: string,
  diagnostics: Diagnostic[],
): void {
  if (block.embeddedBlocks.length === 0) {
    return;
  }

  const seen = new Set<string>();
  for (const embed of block.embeddedBlocks) {
    if (embed.embeddedBlocks.length > 0) {
      diagnostics.push(
        diag(
          "BML_NESTED_EMBEDDED_BLOCKS",
          `Embedded block ${embed.type} must not declare nested embeddedBlocks`,
          file,
          embed.source?.line,
          embed.source?.column,
        ),
      );
    }
    if (embed.type) {
      if (seen.has(embed.type)) {
        diagnostics.push(
          diag(
            "BML_DUPLICATE_EMBEDDED_BLOCK",
            `Duplicate embedded block FQN: ${embed.type}`,
            file,
            embed.source?.line,
            embed.source?.column,
          ),
        );
      }
      seen.add(embed.type);
    }
  }
}

export function validateEmbeddedBlocks(document: BomDocument): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const file = document.source.filePath ?? "<memory>";
  const root = document.block;

  validateEmbeddedBlocksOnRoot(root, file, diagnostics);
  validateSubBlocks(root, file, diagnostics);

  return diagnostics;
}
