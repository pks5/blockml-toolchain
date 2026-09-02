import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bootstrapFullProjectRegistry } from "@blockml/framework";
import { buildManifest, MANIFEST_FILE, manifestIsCurrent, readManifest, resolveDbDir, resolveIndexDir, } from "./fingerprint.js";
import { GraphIndex } from "./graph-index.js";
import { acquireGraphLock } from "./graph-lock.js";
import { createLadybugStore, openLadybugStore, populateStore } from "./ladybug-store.js";
import { graphDataFromRegistry } from "./mapper.js";
import { MEMORY_DB_PATH } from "./store.js";
export { DEFAULT_GRAPH_DEPTH, INDEX_FORMAT_VERSION } from "./types.js";
export { GraphIndex } from "./graph-index.js";
export { graphDataFromRegistry } from "./mapper.js";
export { collectNamedTypes } from "./type-refs.js";
export { defaultIndexDir, resolveIndexDir } from "./fingerprint.js";
export { graphSchema } from "./schema.js";
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
function resolvedBlockCount(data) {
    return data.blocks.filter((block) => block.resolved).length;
}
export async function buildMemoryIndex(registry, options = {}) {
    const mapping = {};
    if (options.rootDir !== undefined) {
        mapping.rootDir = options.rootDir;
    }
    if (options.srcDir !== undefined) {
        mapping.srcDir = options.srcDir;
    }
    const data = graphDataFromRegistry(registry, mapping);
    const store = await createLadybugStore(MEMORY_DB_PATH);
    await populateStore(store, data);
    return new GraphIndex(store, resolvedBlockCount(data), data.members.length, data.filePaths, options.diagnostics ?? []);
}
export async function buildIndex(options = {}) {
    const { rootDir, srcDir, libraries } = resolveOptions(options);
    const bootstrap = bootstrapFullProjectRegistry({ rootDir, srcDir, libraries });
    const index = await buildMemoryIndex(bootstrap.registry, {
        rootDir,
        srcDir,
        diagnostics: bootstrap.diagnostics,
    });
    return {
        index,
        diagnostics: bootstrap.diagnostics,
        blocks: index.blocks,
        members: index.memberCount,
    };
}
export async function getIndexStatus(options = {}) {
    const { rootDir, srcDir, indexDir } = resolveOptions(options);
    const dbDir = resolveDbDir(indexDir);
    const manifest = readManifest(indexDir);
    if (!existsSync(dbDir) || !manifest) {
        return { state: "missing", indexDir };
    }
    if (!manifestIsCurrent(manifest, rootDir, srcDir)) {
        const status = { state: "stale", indexDir };
        status.blocks = manifest.blocks;
        status.members = manifest.members;
        return status;
    }
    const ready = { state: "ready", indexDir };
    ready.blocks = manifest.blocks;
    ready.members = manifest.members;
    return ready;
}
export async function loadIndex(options = {}) {
    const { indexDir } = resolveOptions(options);
    const status = await getIndexStatus(options);
    if (status.state !== "ready") {
        return undefined;
    }
    const manifest = readManifest(indexDir);
    if (!manifest) {
        return undefined;
    }
    const store = await openLadybugStore(resolveDbDir(indexDir));
    return new GraphIndex(store, manifest.blocks, manifest.members, manifest.files.map((file) => file.path));
}
function holdUntilClose(index, release) {
    const innerClose = index.close.bind(index);
    let released = false;
    const close = async () => {
        try {
            await innerClose();
        }
        finally {
            if (!released) {
                released = true;
                await release();
            }
        }
    };
    return Object.assign(index, { close });
}
async function rebuildIndexUnlocked(options) {
    const { rootDir, srcDir, libraries, indexDir } = resolveOptions(options);
    const bootstrap = bootstrapFullProjectRegistry({ rootDir, srcDir, libraries });
    const data = graphDataFromRegistry(bootstrap.registry, { rootDir, srcDir });
    const dbDir = resolveDbDir(indexDir);
    rmSync(dbDir, { recursive: true, force: true });
    mkdirSync(indexDir, { recursive: true });
    const store = await createLadybugStore(dbDir);
    await populateStore(store, data);
    const index = new GraphIndex(store, resolvedBlockCount(data), data.members.length, data.filePaths, bootstrap.diagnostics);
    const manifest = buildManifest(rootDir, index.filePaths, index.blocks, index.memberCount);
    writeFileSync(join(indexDir, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    return {
        index,
        diagnostics: bootstrap.diagnostics,
        blocks: index.blocks,
        members: index.memberCount,
    };
}
export async function rebuildIndex(options = {}) {
    const { indexDir } = resolveOptions(options);
    const release = await acquireGraphLock(indexDir);
    try {
        const result = await rebuildIndexUnlocked(options);
        holdUntilClose(result.index, release);
        return result;
    }
    catch (error) {
        await release();
        throw error;
    }
}
export async function openGraph(options = {}) {
    const { indexDir } = resolveOptions(options);
    const release = await acquireGraphLock(indexDir);
    try {
        const loaded = await loadIndex(options);
        if (loaded) {
            holdUntilClose(loaded, release);
            return {
                index: loaded,
                diagnostics: loaded.diagnostics,
                blocks: loaded.blocks,
                members: loaded.memberCount,
            };
        }
        const result = await rebuildIndexUnlocked(options);
        holdUntilClose(result.index, release);
        return result;
    }
    catch (error) {
        await release();
        throw error;
    }
}
//# sourceMappingURL=index.js.map