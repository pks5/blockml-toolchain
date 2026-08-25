import { bootstrapTypeRegistry, defaultBootstrapPaths, TypeRegistry, } from "@blockml/framework";
import { compileBmlToBom, validateRegistryDocuments } from "./compile-bml-to-bom.js";
import { buildRenderSession, createRenderContext } from "./render-context.js";
import { resolveScope, scopeAccepts } from "./scope.js";
import { getTarget } from "./target-registry.js";
function bootstrapForScope(resolved, options) {
    const rootDir = options.rootDir ?? process.cwd();
    if (options.typeRegistry &&
        (resolved.kind === "library" || resolved.kind === "corpus")) {
        return { registry: options.typeRegistry, diagnostics: [] };
    }
    if (resolved.kind === "document" && resolved.document) {
        const registry = options.typeRegistry ?? new TypeRegistry();
        const bomResult = compileBmlToBom(resolved.document, {
            ...options,
            typeRegistry: registry,
        });
        if (bomResult.output?.block.type) {
            registry.register(bomResult.output);
        }
        return { registry, diagnostics: bomResult.diagnostics };
    }
    if (resolved.kind === "library" && resolved.libraries) {
        const bootstrap = bootstrapTypeRegistry({
            libraryPaths: resolved.libraries,
            paths: defaultBootstrapPaths(rootDir),
            rootDir,
        });
        if (options.typeRegistry) {
            for (const fqn of bootstrap.registry.keys()) {
                const doc = bootstrap.registry.get(fqn);
                if (doc) {
                    options.typeRegistry.register(doc);
                }
            }
            return {
                registry: options.typeRegistry,
                diagnostics: bootstrap.diagnostics,
            };
        }
        return bootstrap;
    }
    const roots = resolved.kind === "corpus" && resolved.roots?.length
        ? resolved.roots
        : defaultBootstrapPaths(rootDir);
    const bootstrap = bootstrapTypeRegistry({
        paths: roots,
        rootDir,
    });
    if (options.typeRegistry) {
        for (const fqn of bootstrap.registry.keys()) {
            const doc = bootstrap.registry.get(fqn);
            if (doc) {
                options.typeRegistry.register(doc);
            }
        }
        return {
            registry: options.typeRegistry,
            diagnostics: bootstrap.diagnostics,
        };
    }
    return bootstrap;
}
function diagnostic(code, message, file) {
    return {
        severity: "error",
        code,
        message,
        source: { file, line: 1, column: 1 },
    };
}
function renderWithTarget(target, request, sessionOptions, priorDiagnostics) {
    const diagnostics = [...priorDiagnostics];
    if (target.validateRequest) {
        diagnostics.push(...target.validateRequest(request));
    }
    const session = buildRenderSession(sessionOptions);
    const ctx = createRenderContext(session);
    const output = target.render(request, ctx);
    if (output.diagnostics) {
        diagnostics.push(...output.diagnostics);
    }
    const success = !diagnostics.some((d) => d.severity === "error");
    return { output, diagnostics, success };
}
function sessionOptionsFromResolved(resolved, registry, targetName, options) {
    const sessionOptions = {
        typeRegistry: registry,
        targetName,
        scopeKind: resolved.kind,
    };
    if (options.outputBasePath !== undefined) {
        sessionOptions.outputBasePath = options.outputBasePath;
    }
    if (resolved.document?.filePath !== undefined) {
        sessionOptions.sourceFilePath = resolved.document.filePath;
    }
    if (resolved.libraries !== undefined) {
        sessionOptions.libraryPaths = resolved.libraries;
    }
    if (resolved.roots !== undefined) {
        sessionOptions.corpusRoots = resolved.roots;
    }
    return sessionOptions;
}
export function compileBomToOutput(document, targetName, options) {
    const fileHint = document.source?.filePath ?? options.rootDir ?? "<memory>";
    if (!options.typeRegistry) {
        return {
            output: null,
            diagnostics: [
                diagnostic("BML_MISSING_TYPE_REGISTRY", "compileBomToOutput requires options.typeRegistry", fileHint),
            ],
            success: false,
        };
    }
    const target = getTarget(targetName);
    if (!target) {
        return {
            output: null,
            diagnostics: [
                diagnostic("BML_UNKNOWN_TARGET", `Unknown render target: ${targetName}`, fileHint),
            ],
            success: false,
        };
    }
    if (!scopeAccepts("document", target.accepts)) {
        return {
            output: null,
            diagnostics: [
                diagnostic("BML_TARGET_SCOPE_MISMATCH", `Target "${targetName}" does not accept scope kind "document"`, fileHint),
            ],
            success: false,
        };
    }
    const registry = options.typeRegistry;
    const sourceFilePath = document.source?.filePath ?? "<memory>";
    const diagnostics = [
        ...validateRegistryDocuments(registry, [sourceFilePath]).diagnostics,
    ];
    const request = { scope: { kind: "document" } };
    if (options.targetOptions !== undefined) {
        request.targetOptions = options.targetOptions;
    }
    const sessionOptions = {
        typeRegistry: registry,
        targetName,
        scopeKind: "document",
        sourceFilePath,
    };
    if (options.outputBasePath !== undefined) {
        sessionOptions.outputBasePath = options.outputBasePath;
    }
    return renderWithTarget(target, request, sessionOptions, diagnostics);
}
export function compileBmlToOutput(input, targetName, options = {}) {
    return compileToOutput({ scope: { kind: "document", document: input } }, targetName, options);
}
export function compileToOutput(request, targetName, options = {}, configHints = {}) {
    const diagnostics = [];
    const target = getTarget(targetName);
    const configFile = configHints.rootDir ?? "<config>";
    if (!target) {
        return {
            output: null,
            diagnostics: [
                diagnostic("BML_UNKNOWN_TARGET", `Unknown render target: ${targetName}`, configFile),
            ],
            success: false,
        };
    }
    const scopeHints = {};
    const hintRoot = options.rootDir ?? configHints.rootDir;
    if (hintRoot !== undefined) {
        scopeHints.rootDir = hintRoot;
    }
    if (configHints.libraries !== undefined) {
        scopeHints.libraries = configHints.libraries;
    }
    if (configHints.roots !== undefined) {
        scopeHints.roots = configHints.roots;
    }
    const { resolved, diagnostics: scopeDiagnostics } = resolveScope(request.scope, scopeHints);
    diagnostics.push(...scopeDiagnostics);
    if (!resolved) {
        return { output: null, diagnostics, success: false };
    }
    if (!scopeAccepts(resolved.kind, target.accepts)) {
        diagnostics.push(diagnostic("BML_TARGET_SCOPE_MISMATCH", `Target "${targetName}" does not accept scope kind "${resolved.kind}"`, scopeHints.rootDir ?? "<config>"));
        return { output: null, diagnostics, success: false };
    }
    const { registry, diagnostics: bootstrapDiagnostics } = bootstrapForScope(resolved, options);
    diagnostics.push(...bootstrapDiagnostics);
    // Stage-2 validation is reported via blockml validate; BlockDoc control gate renders
    // the corpus for structural review without failing on semantic validation gaps.
    if (resolved.kind === "document" && resolved.document) {
        diagnostics.push(...validateRegistryDocuments(registry, [resolved.document.filePath]).diagnostics);
    }
    return renderWithTarget(target, request, sessionOptionsFromResolved(resolved, registry, targetName, options), diagnostics);
}
//# sourceMappingURL=compile-to-output.js.map