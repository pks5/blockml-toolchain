import { resolveEffectiveMembers } from "../resolve/resolve-effective-members.js";
function diag(code, message, file, line = 1, column = 1) {
    return { severity: "error", code, message, source: { file, line, column } };
}
function walkCompositionInstances(nodes, visit) {
    for (const node of nodes) {
        if (node.kind === "blockInstance") {
            visit(node.instance);
            for (const agg of node.instance.aggregationCompositions ?? []) {
                walkCompositionInstances(agg.composition.children, visit);
            }
        }
        else {
            walkCompositionInstances(node.children, visit);
        }
    }
}
function detectPresetCycleOnInstance(instance, chain, idsInDocument, file, diagnostics) {
    if (!instance.basePresets) {
        return;
    }
    const ref = instance.basePresets;
    const id = ref.includes("::") ? ref.split("::").pop() : ref;
    if (chain.includes(id)) {
        diagnostics.push(diag("BML_PRESET_CYCLE", `Preset inheritance cycle: ${[...chain, id].join(" → ")}`, file, instance.source?.line, instance.source?.column));
        return;
    }
    if (!idsInDocument.has(id)) {
        return;
    }
    chain.push(id);
}
function collectPresetIds(block) {
    const ids = new Set();
    const visit = (instance) => {
        const id = instance.id?.kind === "literal" && typeof instance.id.value === "string"
            ? instance.id.value
            : undefined;
        if (id) {
            ids.add(id);
        }
    };
    for (const template of block.compositions) {
        walkCompositionInstances(template.children, visit);
    }
    for (const sub of block.subBlocks) {
        for (const id of collectPresetIds(sub)) {
            ids.add(id);
        }
    }
    return ids;
}
function validatePresetProperties(block, registry, file, diagnostics) {
    const effective = resolveEffectiveMembers(block, registry);
    const names = new Set(effective.map((m) => m.name));
    for (const member of block.members) {
        if (member.kind !== "property" || !member.suggestions?.length) {
            continue;
        }
        for (const suggestion of member.suggestions) {
            const propName = suggestion.memberValues["name"];
            if (propName?.kind === "literal" &&
                typeof propName.value === "string" &&
                !names.has(propName.value)) {
                diagnostics.push(diag("BML_UNKNOWN_PROPERTY", `Preset property ${propName.value} is not a member of ${block.type}`, file, suggestion.source?.line, suggestion.source?.column));
            }
        }
    }
    for (const sub of block.subBlocks) {
        validatePresetProperties(sub, registry, file, diagnostics);
    }
}
export function validatePresets(document, registry) {
    const diagnostics = [];
    const file = document.source.filePath ?? "<memory>";
    const presetIds = collectPresetIds(document.block);
    const visit = (instance) => {
        detectPresetCycleOnInstance(instance, [], presetIds, file, diagnostics);
    };
    for (const template of document.block.compositions) {
        walkCompositionInstances(template.children, visit);
    }
    validatePresetProperties(document.block, registry, file, diagnostics);
    return diagnostics;
}
//# sourceMappingURL=validate-presets.js.map