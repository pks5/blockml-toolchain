function diag(code, message, file, line = 1, column = 1) {
    return { severity: "error", code, message, source: { file, line, column } };
}
function isFrameworkConventionBlock(typeFqn) {
    return typeFqn.startsWith("org.blockml.bml.");
}
function requiresExplicitVersion(block) {
    if (!block.type || block.version) {
        return false;
    }
    if (isFrameworkConventionBlock(block.type)) {
        return false;
    }
    return true;
}
function literalString(val) {
    if (!val || val.kind !== "literal") {
        return undefined;
    }
    return String(val.value);
}
function checkVersionPin(instance, registry, file, diagnostics) {
    const pin = literalString(instance.version);
    if (!pin) {
        return;
    }
    const doc = registry.get(instance.typeFqn);
    if (!doc) {
        diagnostics.push(diag("BML_UNKNOWN_VERSION", `Unknown type for version pin: ${instance.typeFqn}@${pin}`, file, instance.source?.line, instance.source?.column));
        return;
    }
    if (doc.block.version && doc.block.version !== pin) {
        diagnostics.push(diag("BML_UNKNOWN_VERSION", `Version pin ${pin} does not match ${instance.typeFqn} (${doc.block.version})`, file, instance.source?.line, instance.source?.column));
    }
}
function walkCompositionInstances(block, registry, file, diagnostics) {
    for (const template of block.compositions) {
        const walkNodes = (nodes) => {
            for (const node of nodes) {
                if (node.kind === "blockInstance") {
                    checkVersionPin(node.instance, registry, file, diagnostics);
                }
                else {
                    walkNodes(node.children);
                }
            }
        };
        walkNodes(template.children);
    }
}
function validateBlockVersions(block, registry, file, diagnostics, isDocumentRoot) {
    if (isDocumentRoot && requiresExplicitVersion(block)) {
        diagnostics.push(diag("BML_MISSING_VERSION", `Missing version on block ${block.type}`, file, block.source?.line, block.source?.column));
    }
    walkCompositionInstances(block, registry, file, diagnostics);
    for (const sub of block.subBlocks) {
        validateBlockVersions(sub, registry, file, diagnostics, false);
    }
}
export function validateVersions(document, registry) {
    const diagnostics = [];
    const file = document.source.filePath ?? "<memory>";
    if (document.block.type && !registry.has(document.block.type)) {
        registry.register(document);
    }
    validateBlockVersions(document.block, registry, file, diagnostics, true);
    return diagnostics;
}
//# sourceMappingURL=validate-versions.js.map