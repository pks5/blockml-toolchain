import { pathToFileURL } from "node:url";
import { hitAt, memberTypeFqn, navigationFqn } from "./hit-test.js";
import { bomLocationToRange } from "./positions.js";
import { workspaceForOpenText } from "./workspace.js";
function locationFromSource(loc) {
    if (!loc.file) {
        return undefined;
    }
    return {
        uri: pathToFileURL(loc.file).href,
        range: bomLocationToRange(loc),
    };
}
function definitionLocation(workspace, fqn) {
    const source = workspace.registry.get(fqn)?.block.source;
    return source ? locationFromSource(source) : undefined;
}
export function definitionAt(text, filePath, position, workspace) {
    const scoped = workspaceForOpenText(workspace, text, filePath);
    const hit = hitAt(text, filePath, position, scoped);
    if (!hit || hit.kind !== "typeRef") {
        return null;
    }
    const fqn = navigationFqn(hit);
    if (!fqn) {
        return null;
    }
    const target = definitionLocation(scoped, fqn);
    if (!target) {
        return null;
    }
    return [{ originSelectionRange: hit.range, target }];
}
function pushLocation(out, loc) {
    const location = loc ? locationFromSource(loc) : undefined;
    if (location) {
        out.push(location);
    }
}
function collectUsages(block, fqn, includeDeclaration, out) {
    if (includeDeclaration && block.type === fqn) {
        pushLocation(out, block.source);
    }
    if (block.baseType === fqn) {
        pushLocation(out, block.baseTypeSource);
    }
    for (const member of block.members) {
        if (memberTypeFqn(member) === fqn) {
            pushLocation(out, member.source);
        }
    }
}
export function referencesAt(text, filePath, position, workspace, includeDeclaration = true) {
    const scoped = workspaceForOpenText(workspace, text, filePath);
    const hit = hitAt(text, filePath, position, scoped);
    if (!hit) {
        return null;
    }
    const fqn = navigationFqn(hit);
    if (!fqn) {
        return null;
    }
    const out = [];
    for (const key of scoped.registry.keys()) {
        const doc = scoped.registry.get(key);
        if (!doc) {
            continue;
        }
        collectUsages(doc.block, fqn, includeDeclaration, out);
    }
    return out;
}
//# sourceMappingURL=navigation.js.map