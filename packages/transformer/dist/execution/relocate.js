import { forkBom, rootFqnByFilePath } from "@blockml/framework";
import { serialize } from "@blockml/serializer";
import { mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { executionFilePath, executionFqn, lifecyclePackageFqn, parseExecutionFqn, } from "./lifecycle.js";
import { TransformError } from "./errors.js";
export function applyExecutionIdentity(document, identity) {
    const nextFqn = executionFqn(identity.libraryFqn, identity.stage, identity.name);
    const previousFqn = document.block.type;
    const previousPath = document.source.filePath;
    const nextPath = executionFilePath(previousPath, identity.stage, identity.name);
    const nextPackage = lifecyclePackageFqn(identity.libraryFqn, identity.stage);
    document.block.name = identity.name;
    document.block.type = nextFqn;
    document.source.filePath = nextPath;
    const bindings = { ...(document.source.namespaceBindings ?? {}) };
    for (const stage of ["pending", "running", "completed"]) {
        delete bindings[stage];
    }
    for (const [prefix, uri] of Object.entries(bindings)) {
        if (uri === lifecyclePackageFqn(identity.libraryFqn, "pending")) {
            delete bindings[prefix];
        }
        if (uri === lifecyclePackageFqn(identity.libraryFqn, "running")) {
            delete bindings[prefix];
        }
        if (uri === lifecyclePackageFqn(identity.libraryFqn, "completed")) {
            delete bindings[prefix];
        }
    }
    bindings[identity.stage] = nextPackage;
    document.source.namespaceBindings = bindings;
    rewriteTriviaFqn(document, previousFqn, nextFqn);
    return nextFqn;
}
export function rewriteInboundReferences(registry, oldFqn, newFqn, exceptFilePath) {
    const roots = rootFqnByFilePath(registry);
    const written = new Set();
    for (const [filePath, rootFqn] of roots) {
        if (filePath === exceptFilePath || written.has(filePath)) {
            continue;
        }
        const original = registry.get(rootFqn);
        if (!original) {
            continue;
        }
        const forked = forkBom(original);
        const fqnChanged = rewriteFqnDeep(forked, oldFqn, newFqn);
        const bindingsChanged = rewriteLifecycleBindings(forked, oldFqn, newFqn);
        if (!fqnChanged && !bindingsChanged) {
            continue;
        }
        persistDocument(forked);
        written.add(filePath);
    }
}
export function persistDocument(document) {
    const filePath = document.source.filePath;
    const result = serialize(document);
    if (!result.success || result.text === null) {
        throw new TransformError("execution", `Failed to serialize ${document.block.type} to ${filePath}`);
    }
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, result.text, "utf8");
}
export function removeFile(filePath) {
    unlinkSync(filePath);
}
function rewriteLifecycleBindings(document, oldFqn, newFqn) {
    const oldParsed = parseExecutionFqn(oldFqn);
    const newParsed = parseExecutionFqn(newFqn);
    const bindings = document.source.namespaceBindings;
    if (!oldParsed || !newParsed || !bindings) {
        return false;
    }
    const oldPkg = lifecyclePackageFqn(oldParsed.libraryFqn, oldParsed.stage);
    const newPkg = lifecyclePackageFqn(newParsed.libraryFqn, newParsed.stage);
    let changed = false;
    for (const [prefix, uri] of Object.entries(bindings)) {
        if (uri !== oldPkg) {
            continue;
        }
        delete bindings[prefix];
        const nextPrefix = prefix === oldParsed.stage ? newParsed.stage : prefix;
        bindings[nextPrefix] = newPkg;
        changed = true;
    }
    return changed;
}
function rewriteTriviaFqn(document, oldFqn, newFqn) {
    const trivia = document.block.xmlTrivia;
    if (!trivia?.leadingComments) {
        return;
    }
    trivia.leadingComments = trivia.leadingComments.map((comment) => comment.replaceAll(oldFqn, newFqn));
}
function rewriteFqnDeep(value, oldFqn, newFqn) {
    let changed = false;
    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
            if (value[i] === oldFqn) {
                value[i] = newFqn;
                changed = true;
            }
            else if (rewriteFqnDeep(value[i], oldFqn, newFqn)) {
                changed = true;
            }
        }
        return changed;
    }
    if (value && typeof value === "object") {
        const record = value;
        for (const [key, entry] of Object.entries(record)) {
            if (entry === oldFqn) {
                record[key] = newFqn;
                changed = true;
            }
            else if (rewriteFqnDeep(entry, oldFqn, newFqn)) {
                changed = true;
            }
        }
    }
    return changed;
}
//# sourceMappingURL=relocate.js.map