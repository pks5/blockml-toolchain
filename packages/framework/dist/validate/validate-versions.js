import { findOwningLibraryDocument } from "../registry/library-membership.js";
function diag(code, message, file, line = 1, column = 1) {
    return { severity: "error", code, message, source: { file, line, column } };
}
function effectiveBlockVersion(block, registry, file) {
    if (block.version) {
        return block.version;
    }
    const owning = findOwningLibraryDocument(registry, block.type, file);
    return owning?.block.version;
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
    const effective = effectiveBlockVersion(doc.block, registry, doc.source.filePath);
    if (!effective) {
        diagnostics.push(diag("BML_UNKNOWN_VERSION", `bml:version is not allowed on unversioned type ${instance.typeFqn}`, file, instance.source?.line, instance.source?.column));
        return;
    }
    if (effective !== pin) {
        diagnostics.push(diag("BML_UNKNOWN_VERSION", `Version pin ${pin} does not match ${instance.typeFqn} (${effective})`, file, instance.source?.line, instance.source?.column));
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
function validateBlockVersions(block, registry, file, diagnostics) {
    walkCompositionInstances(block, registry, file, diagnostics);
    for (const sub of block.subBlocks) {
        validateBlockVersions(sub, registry, file, diagnostics);
    }
}
export function validateVersions(document, registry) {
    const diagnostics = [];
    const file = document.source.filePath ?? "<memory>";
    if (document.block.type && !registry.has(document.block.type)) {
        registry.register(document);
    }
    validateBlockVersions(document.block, registry, file, diagnostics);
    return diagnostics;
}
//# sourceMappingURL=validate-versions.js.map