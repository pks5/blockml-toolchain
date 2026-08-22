function diag(code, message, file, line = 1, column = 1) {
    return { severity: "error", code, message, source: { file, line, column } };
}
function literalString(val) {
    if (!val || val.kind !== "literal") {
        return undefined;
    }
    return typeof val.value === "string" ? val.value : String(val.value);
}
function instanceId(instance) {
    return literalString(instance.id);
}
function collectIdsInComposition(nodes, ids, file) {
    for (const node of nodes) {
        if (node.kind === "blockInstance") {
            const id = instanceId(node.instance);
            if (id) {
                const loc = { file };
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
        }
        else {
            collectIdsInComposition(node.children, ids, file);
        }
    }
}
function collectDocumentInstanceIds(block, file) {
    const ids = new Map();
    for (const template of block.compositions) {
        collectIdsInComposition(template.children, ids, file);
    }
    for (const sub of block.subBlocks) {
        const subIds = collectDocumentInstanceIds(sub, file);
        for (const [id, loc] of subIds) {
            ids.set(id, loc);
        }
    }
    return ids;
}
function resolveInstanceRef(token, ids) {
    if (token.includes("::")) {
        const id = token.split("::").pop();
        return id !== undefined && ids.has(id);
    }
    return ids.has(token);
}
function validateInstanceRefs(instance, ids, file, diagnostics) {
    if (instance.basePresets && !resolveInstanceRef(instance.basePresets, ids)) {
        diagnostics.push(diag("BML_UNRESOLVABLE_INSTANCE_REF", `Unresolved basePresets reference: ${instance.basePresets}`, file, instance.source?.line, instance.source?.column));
    }
    for (const val of Object.values(instance.memberValues)) {
        if (val.kind !== "literal") {
            continue;
        }
        const text = typeof val.value === "string" ? val.value : undefined;
        if (text && text.includes("::") && !resolveInstanceRef(text, ids)) {
            diagnostics.push(diag("BML_UNRESOLVABLE_INSTANCE_REF", `Unresolved instance reference: ${text}`, file, instance.source?.line, instance.source?.column));
        }
    }
    for (const agg of instance.aggregationCompositions ?? []) {
        for (const child of agg.composition.children) {
            if (child.kind === "blockInstance") {
                validateInstanceRefs(child.instance, ids, file, diagnostics);
            }
        }
    }
}
function validateCompositionNodes(nodes, ids, file, diagnostics) {
    for (const node of nodes) {
        if (node.kind === "blockInstance") {
            const hasEach = node.directives?.some((d) => d.type === "each");
            if (hasEach && !instanceId(node.instance)) {
                diagnostics.push(diag("BML_MISSING_ID", "bml:each requires explicit bml:id on the block instance", file, node.source?.line ?? node.instance.source?.line, node.source?.column ?? node.instance.source?.column));
            }
            validateInstanceRefs(node.instance, ids, file, diagnostics);
            for (const agg of node.instance.aggregationCompositions ?? []) {
                validateCompositionNodes(agg.composition.children, ids, file, diagnostics);
            }
        }
        else {
            const hasEach = node.directives?.some((d) => d.type === "each");
            if (hasEach) {
                diagnostics.push(diag("BML_MISSING_ID", "bml:each requires explicit bml:id on the container element", file, node.source?.line, node.source?.column));
            }
            validateCompositionNodes(node.children, ids, file, diagnostics);
        }
    }
}
export function validateInstances(document, _registry) {
    const diagnostics = [];
    const file = document.source.filePath ?? "<memory>";
    const ids = collectDocumentInstanceIds(document.block, file);
    for (const template of document.block.compositions) {
        validateCompositionNodes(template.children, ids, file, diagnostics);
    }
    return diagnostics;
}
//# sourceMappingURL=validate-instances.js.map