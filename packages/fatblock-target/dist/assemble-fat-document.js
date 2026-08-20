import { serialize } from "@blockml/serializer";
import { cloneBlockDefinition } from "./clone-block.js";
import { collectCandidateFqns, rootFqnsByFilePath } from "./collect-candidates.js";
import { mergeNamespaceBindings } from "./merge-namespace-bindings.js";
function diagnostic(code, message, file) {
    return {
        severity: "error",
        code,
        message,
        source: { file, line: 1, column: 1 },
    };
}
function findHostDocument(registry, hostFilePath) {
    const roots = rootFqnsByFilePath(registry);
    const hostFqn = roots.get(hostFilePath);
    if (!hostFqn) {
        return undefined;
    }
    return registry.get(hostFqn);
}
function getRootBlockForFqn(registry, fqn) {
    const doc = registry.get(fqn);
    if (!doc || doc.block.type !== fqn) {
        return undefined;
    }
    return doc.block;
}
export function assembleFatDocument(registry, hostFilePath, options, rootDir) {
    const diagnostics = [];
    const srcDir = options.srcDir;
    if (!srcDir) {
        diagnostics.push(diagnostic("BML_FATBLOCK_SRC_REQUIRED", "FatBlock requires targetOptions.srcDir (CLI: --src)", hostFilePath));
        return { document: null, diagnostics };
    }
    const hostRoot = findHostDocument(registry, hostFilePath);
    if (!hostRoot) {
        diagnostics.push(diagnostic("BML_FATBLOCK_HOST_NOT_FOUND", `Host block not found in registry for ${hostFilePath}`, hostFilePath));
        return { document: null, diagnostics };
    }
    const hostFqn = hostRoot.block.type;
    if (hostRoot.block.embeddedBlocks.length > 0) {
        diagnostics.push(diagnostic("BML_FATBLOCK_HOST_HAS_EMBEDDED_BLOCKS", "Host block already declares embeddedBlocks; FatBlock v1 requires an empty embeddedBlocks on the host", hostFilePath));
        return { document: null, diagnostics };
    }
    const { fqns: candidateFqns } = collectCandidateFqns(registry, srcDir, rootDir, hostFqn, options.include);
    const seen = new Set();
    const embeddedBlocks = [];
    const namespaceSources = [
        {
            file: hostFilePath,
            ...(hostRoot.source.namespaceBindings
                ? { bindings: hostRoot.source.namespaceBindings }
                : {}),
        },
    ];
    for (const fqn of candidateFqns) {
        if (seen.has(fqn)) {
            diagnostics.push(diagnostic("BML_DUPLICATE_EMBEDDED_BLOCK", `Duplicate embed candidate FQN: ${fqn}`, hostFilePath));
            continue;
        }
        seen.add(fqn);
        const sourceBlock = getRootBlockForFqn(registry, fqn);
        const sourceDoc = registry.get(fqn);
        if (!sourceBlock || !sourceDoc) {
            diagnostics.push(diagnostic("BML_FATBLOCK_EMBED_NOT_FOUND", `Embed candidate not found in registry: ${fqn}`, hostFilePath));
            continue;
        }
        if (sourceBlock.embeddedBlocks.length > 0) {
            diagnostics.push(diagnostic("BML_FATBLOCK_EMBED_HAS_EMBEDDED_BLOCKS", `Embed candidate ${fqn} already declares embeddedBlocks`, sourceDoc.source.filePath ?? hostFilePath));
            continue;
        }
        const cloned = cloneBlockDefinition(sourceBlock);
        cloned.embeddedBlocks = [];
        embeddedBlocks.push(cloned);
        namespaceSources.push({
            file: sourceDoc.source.filePath ?? hostFilePath,
            ...(sourceDoc.source.namespaceBindings
                ? { bindings: sourceDoc.source.namespaceBindings }
                : {}),
        });
    }
    if (diagnostics.some((d) => d.severity === "error")) {
        return { document: null, diagnostics };
    }
    const { bindings, diagnostics: mergeDiagnostics } = mergeNamespaceBindings(namespaceSources);
    diagnostics.push(...mergeDiagnostics);
    if (mergeDiagnostics.some((d) => d.severity === "error")) {
        return { document: null, diagnostics };
    }
    const assembled = {
        kind: "block",
        source: {
            ...hostRoot.source,
            namespaceBindings: bindings,
        },
        block: {
            ...cloneBlockDefinition(hostRoot.block),
            embeddedBlocks,
        },
    };
    return { document: assembled, diagnostics };
}
export function serializeFatDocument(document) {
    const result = serialize(document, { indent: 2 });
    return {
        text: result.text,
        diagnostics: result.diagnostics,
    };
}
//# sourceMappingURL=assemble-fat-document.js.map