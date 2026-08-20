import { escapeHtml } from "./fqn-path.js";
import { renderTypeRef } from "./type-links.js";
function memberValueLabel(value) {
    if (!value) {
        return undefined;
    }
    if (value.kind === "literal") {
        return String(value.value);
    }
    if (value.kind === "expression") {
        return value.raw;
    }
    return value.address.raw;
}
function memberValuesSummary(instance) {
    const keys = Object.keys(instance.memberValues);
    if (keys.length === 0) {
        return "";
    }
    if (keys.length <= 5) {
        return keys.join(", ");
    }
    return `${keys.slice(0, 5).join(", ")} (+${keys.length - 5} more)`;
}
function directiveSummary(directives) {
    if (!directives?.length) {
        return "container";
    }
    return directives
        .map((d) => {
        switch (d.type) {
            case "each":
                return `each ${d.variables.join(", ")}`;
            case "if":
                return "if";
            case "unless":
                return "unless";
            case "with":
                return `with ${d.bindings.map((b) => b.name).join(", ")}`;
        }
    })
        .join(", ");
}
function renderCompositionNode(node, pagePath, options, knownFqns) {
    if (node.kind === "blockInstance") {
        const inst = node.instance;
        const id = memberValueLabel(inst.id);
        const values = memberValuesSummary(inst);
        const type = renderTypeRef(inst.typeFqn, pagePath, options, knownFqns);
        const details = [type];
        if (id) {
            details.push(`id=${escapeHtml(id)}`);
        }
        if (values) {
            details.push(`members: ${escapeHtml(values)}`);
        }
        return `<li>${details.join(" — ")}</li>`;
    }
    const label = escapeHtml(directiveSummary(node.directives));
    const children = node.children
        .map((child) => renderCompositionNode(child, pagePath, options, knownFqns))
        .join("\n");
    return `<li>${label}<ul>${children}</ul></li>`;
}
export function renderCompositionGroup(aggregationName, composition, pagePath, options, knownFqns) {
    if (!composition.children.length) {
        return "";
    }
    const items = composition.children
        .map((child) => renderCompositionNode(child, pagePath, options, knownFqns))
        .join("\n");
    return `<section><h3>${escapeHtml(aggregationName)}</h3><ul>${items}</ul></section>`;
}
//# sourceMappingURL=composition-render.js.map