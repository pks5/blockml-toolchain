export function resolveScope(scope, hints = {}) {
    const diagnostics = [];
    if (scope.kind === "document") {
        if (!scope.document) {
            diagnostics.push({
                severity: "error",
                code: "BML_COMPILE_SCOPE_EMPTY",
                message: "Document scope requires scope.document",
                source: { file: hints.rootDir ?? "<config>", line: 1, column: 1 },
            });
            return { resolved: null, diagnostics };
        }
        return {
            resolved: { kind: "document", document: scope.document },
            diagnostics,
        };
    }
    if (scope.kind === "library") {
        const libraries = scope.libraries ?? hints.libraries ?? [];
        if (libraries.length === 0) {
            diagnostics.push({
                severity: "error",
                code: "BML_COMPILE_SCOPE_EMPTY",
                message: "Library scope requires libraries[]",
                source: { file: hints.rootDir ?? "<config>", line: 1, column: 1 },
            });
            return { resolved: null, diagnostics };
        }
        return { resolved: { kind: "library", libraries }, diagnostics };
    }
    if (scope.kind === "corpus") {
        const roots = scope.roots ?? hints.roots ?? [];
        if (roots.length === 0) {
            diagnostics.push({
                severity: "error",
                code: "BML_COMPILE_SCOPE_EMPTY",
                message: "Corpus scope requires roots[]",
                source: { file: hints.rootDir ?? "<config>", line: 1, column: 1 },
            });
            return { resolved: null, diagnostics };
        }
        return { resolved: { kind: "corpus", roots }, diagnostics };
    }
    // auto
    const libraries = scope.libraries ?? hints.libraries ?? [];
    if (libraries.length > 0) {
        return { resolved: { kind: "library", libraries }, diagnostics };
    }
    const roots = scope.roots ?? hints.roots ?? [];
    if (roots.length > 0) {
        return { resolved: { kind: "corpus", roots }, diagnostics };
    }
    diagnostics.push({
        severity: "error",
        code: "BML_COMPILE_SCOPE_EMPTY",
        message: "Auto scope resolution found no libraries or roots",
        source: { file: hints.rootDir ?? "<config>", line: 1, column: 1 },
    });
    return { resolved: null, diagnostics };
}
export function scopeAccepts(resolvedKind, accepts) {
    if (accepts.includes(resolvedKind)) {
        return true;
    }
    if (accepts.includes("auto") &&
        (resolvedKind === "library" || resolvedKind === "corpus")) {
        return true;
    }
    return false;
}
//# sourceMappingURL=scope.js.map