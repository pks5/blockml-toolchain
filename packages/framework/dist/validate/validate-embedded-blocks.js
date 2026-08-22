function diag(code, message, file, line = 1, column = 1) {
    return { severity: "error", code, message, source: { file, line, column } };
}
function expectedSubBlockType(parentType, subName) {
    return `${parentType}.${subName}`;
}
function validateSubBlocks(block, file, diagnostics) {
    for (const sub of block.subBlocks) {
        if (sub.embeddedBlocks.length > 0) {
            diagnostics.push(diag("BML_EMBEDDED_BLOCKS_ON_SUBBLOCK", `Sub-block ${sub.name} must not declare embeddedBlocks`, file, sub.source?.line, sub.source?.column));
        }
        const expected = expectedSubBlockType(block.type, sub.name);
        if (sub.type && sub.type !== expected) {
            diagnostics.push(diag("BML_SUBBLOCK_TYPE_MISMATCH", `Sub-block ${sub.name} type ${sub.type} does not match expected ${expected}`, file, sub.source?.line, sub.source?.column));
        }
        validateSubBlocks(sub, file, diagnostics);
    }
}
function validateEmbeddedBlocksOnRoot(block, file, diagnostics) {
    if (block.embeddedBlocks.length === 0) {
        return;
    }
    const seen = new Set();
    for (const embed of block.embeddedBlocks) {
        if (embed.embeddedBlocks.length > 0) {
            diagnostics.push(diag("BML_NESTED_EMBEDDED_BLOCKS", `Embedded block ${embed.type} must not declare nested embeddedBlocks`, file, embed.source?.line, embed.source?.column));
        }
        if (embed.type) {
            if (seen.has(embed.type)) {
                diagnostics.push(diag("BML_DUPLICATE_EMBEDDED_BLOCK", `Duplicate embedded block FQN: ${embed.type}`, file, embed.source?.line, embed.source?.column));
            }
            seen.add(embed.type);
        }
    }
}
export function validateEmbeddedBlocks(document) {
    const diagnostics = [];
    const file = document.source.filePath ?? "<memory>";
    const root = document.block;
    validateEmbeddedBlocksOnRoot(root, file, diagnostics);
    validateSubBlocks(root, file, diagnostics);
    return diagnostics;
}
//# sourceMappingURL=validate-embedded-blocks.js.map