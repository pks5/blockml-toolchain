import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bootstrapFullProjectRegistry } from "@blockml/framework";
import { documentsFromRegistry } from "./documents.js";
import { buildManifest, MANIFEST_FILE, manifestIsCurrent, ORAMA_FILE, readManifest, resolveIndexDir, } from "./fingerprint.js";
import { createSearchIndex, restoreSearchIndex, SearchIndex } from "./orama-index.js";
export { SearchIndex } from "./orama-index.js";
export { blockToSearchDocument, documentsFromRegistry, fqnToPackagePrefix } from "./documents.js";
export { defaultIndexDir, resolveIndexDir } from "./fingerprint.js";
function resolveOptions(options = {}) {
    const rootDir = options.rootDir ?? process.cwd();
    const srcDir = options.srcDir ?? "blocks";
    return {
        rootDir,
        srcDir,
        libraries: options.libraries ?? [],
        indexDir: resolveIndexDir(rootDir, options.indexDir),
    };
}
export async function buildMemoryIndex(documents, diagnostics = []) {
    return createSearchIndex(documents, diagnostics);
}
export async function buildIndex(options = {}) {
    const { rootDir, srcDir, libraries } = resolveOptions(options);
    const bootstrap = bootstrapFullProjectRegistry({ rootDir, srcDir, libraries });
    const documents = documentsFromRegistry(bootstrap.registry);
    const index = await createSearchIndex(documents, bootstrap.diagnostics);
    return {
        index,
        diagnostics: bootstrap.diagnostics,
        documents: documents.length,
    };
}
export async function saveIndex(index, options = {}) {
    const { rootDir, indexDir } = resolveOptions(options);
    mkdirSync(indexDir, { recursive: true });
    writeFileSync(join(indexDir, ORAMA_FILE), await index.serialize(), "utf8");
    const manifest = buildManifest(rootDir, index.filePaths, index.documents);
    writeFileSync(join(indexDir, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}
export async function loadIndex(options = {}) {
    const { indexDir } = resolveOptions(options);
    const status = await getIndexStatus(options);
    if (status.state !== "ready") {
        return undefined;
    }
    const serialized = readFileSync(join(indexDir, ORAMA_FILE), "utf8");
    const manifest = readManifest(indexDir);
    if (!manifest) {
        return undefined;
    }
    return restoreSearchIndex(serialized, manifest.documents, manifest.files.map((file) => file.path));
}
export async function rebuildIndex(options = {}) {
    const built = await buildIndex(options);
    await saveIndex(built.index, options);
    return built;
}
export async function getIndexStatus(options = {}) {
    const { rootDir, srcDir, indexDir } = resolveOptions(options);
    const oramaPath = join(indexDir, ORAMA_FILE);
    const manifest = readManifest(indexDir);
    if (!existsSync(oramaPath) || !manifest) {
        return { state: "missing", indexDir };
    }
    if (!manifestIsCurrent(manifest, rootDir, srcDir)) {
        return { state: "stale", documents: manifest.documents, indexDir };
    }
    return { state: "ready", documents: manifest.documents, indexDir };
}
export async function openIndex(options = {}) {
    const loaded = await loadIndex(options);
    if (loaded) {
        return {
            index: loaded,
            diagnostics: loaded.diagnostics,
            documents: loaded.documents,
        };
    }
    return rebuildIndex(options);
}
export async function search(query, options = {}) {
    const opened = await openIndex(options);
    const limit = options.limit !== undefined ? { limit: options.limit } : {};
    return opened.index.search(query, limit);
}
//# sourceMappingURL=index.js.map