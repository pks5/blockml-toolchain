import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { projectSourceRoots, registryFilesUnderRoots, rootFqnByFilePath, } from "@blockml/framework";
import { parse } from "@blockml/parser";
import { serialize } from "@blockml/serializer";
import { validate } from "@blockml/validator";
import { workspaceWithOpenDocument } from "./workspace.js";
export function analyzeDocument(text, filePath, workspace) {
    const parseResult = parse(text, { filePath, continueOnError: true });
    const diagnostics = [...parseResult.diagnostics];
    if (!parseResult.document) {
        return { diagnostics, document: null };
    }
    const scoped = workspaceWithOpenDocument(workspace, parseResult.document);
    const validateResult = validate(parseResult.document, {
        typeRegistry: scoped.registry,
        continueOnError: true,
    });
    diagnostics.push(...validateResult.diagnostics);
    return {
        diagnostics,
        document: parseResult.document,
    };
}
function collectBmlFiles(dir, out = []) {
    let entries;
    try {
        entries = readdirSync(dir);
    }
    catch {
        return out;
    }
    for (const entry of entries) {
        if (entry === "node_modules") {
            continue;
        }
        const full = join(dir, entry);
        try {
            const st = statSync(full);
            if (st.isDirectory()) {
                collectBmlFiles(full, out);
            }
            else if (entry.endsWith(".bml")) {
                out.push(resolve(full));
            }
        }
        catch {
            continue;
        }
    }
    return out;
}
function projectWorkspaceRoots(workspace) {
    return projectSourceRoots(workspace.rootDir, workspace.config.srcDir ?? "blocks");
}
/** Absolute project-source .bml paths (registry + unregistered disk files). */
export function listProjectWorkspaceFiles(workspace) {
    const roots = projectWorkspaceRoots(workspace);
    const seen = new Set();
    const files = [];
    const add = (filePath) => {
        const abs = resolve(filePath);
        if (seen.has(abs)) {
            return;
        }
        seen.add(abs);
        files.push(abs);
    };
    for (const filePath of registryFilesUnderRoots(workspace.registry, roots)) {
        add(filePath);
    }
    for (const root of roots) {
        for (const filePath of collectBmlFiles(root)) {
            add(filePath);
        }
    }
    return files.sort();
}
/** Validate a registry document, or parse-only when the file never entered the registry. */
export function analyzeProjectWorkspaceFile(workspace, filePath) {
    const abs = resolve(filePath);
    const rootByFile = rootFqnByFilePath(workspace.registry);
    let fqn = rootByFile.get(abs) ?? rootByFile.get(filePath);
    if (!fqn) {
        for (const [key, value] of rootByFile) {
            if (resolve(key) === abs) {
                fqn = value;
                break;
            }
        }
    }
    const document = fqn ? workspace.registry.get(fqn) : undefined;
    const diagnostics = [];
    if (document) {
        const result = validate(document, {
            typeRegistry: workspace.registry,
            continueOnError: true,
        });
        diagnostics.push(...result.diagnostics);
    }
    else if (existsSync(abs)) {
        try {
            const text = readFileSync(abs, "utf8");
            const parsed = parse(text, { filePath: abs, continueOnError: true });
            diagnostics.push(...parsed.diagnostics);
        }
        catch (e) {
            diagnostics.push({
                severity: "warning",
                code: "BML_BOOTSTRAP_READ_ERROR",
                message: e instanceof Error ? e.message : String(e),
                source: { file: abs, line: 1, column: 1 },
            });
        }
    }
    for (const diagnostic of workspace.bootstrapDiagnostics) {
        const file = diagnostic.source?.file;
        if (file && resolve(file) === abs) {
            diagnostics.push(diagnostic);
        }
    }
    return diagnostics;
}
export function analyzeWorkspace(workspace) {
    const filePaths = listProjectWorkspaceFiles(workspace);
    const diagnostics = [];
    for (const filePath of filePaths) {
        diagnostics.push(...analyzeProjectWorkspaceFile(workspace, filePath));
    }
    return { filePaths, diagnostics };
}
function hasXmlDeclaration(text) {
    return /^\s*<\?xml\b/.test(text);
}
export function formatDocument(text, options = {}) {
    const parseResult = parse(text, { continueOnError: true });
    if (!parseResult.document) {
        return null;
    }
    const serializeOptions = {
        xmlDeclaration: options.xmlDeclaration ?? hasXmlDeclaration(text),
    };
    if (options.indent !== undefined) {
        serializeOptions.indent = options.indent;
    }
    const result = serialize(parseResult.document, serializeOptions);
    return result.text;
}
//# sourceMappingURL=language-service.js.map