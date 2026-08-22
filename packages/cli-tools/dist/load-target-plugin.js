import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
const BUILTIN_TARGETS = new Set(["blockdoc", "xsd", "fatblock"]);
export function isBuiltinTarget(name) {
    return BUILTIN_TARGETS.has(name);
}
export function resolveTargetPackage(config, name) {
    if (isBuiltinTarget(name)) {
        return undefined;
    }
    return config.targetPackages?.[name] ?? name;
}
function readBlockmlPackageMeta(packageName, rootDir) {
    try {
        const require = createRequire(pathToFileURL(join(rootDir, "package.json")).href);
        const pkgPath = require.resolve(`${packageName}/package.json`);
        const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
        return pkg.blockml ?? {};
    }
    catch {
        if (packageName.startsWith(".") || isAbsolute(packageName)) {
            const pkgPath = resolve(rootDir, packageName, "package.json");
            const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
            return pkg.blockml ?? {};
        }
        return {};
    }
}
async function importPackageModule(packageName, rootDir, entry) {
    if (packageName.startsWith(".") || packageName.startsWith("/")) {
        const base = resolve(rootDir, packageName);
        const modulePath = entry
            ? resolve(base, entry)
            : resolve(base, "index.js");
        return (await import(pathToFileURL(modulePath).href));
    }
    if (entry && entry.startsWith(".")) {
        const require = createRequire(pathToFileURL(join(rootDir, "package.json")).href);
        const pkgPath = require.resolve(`${packageName}/package.json`);
        const modulePath = resolve(dirname(pkgPath), entry);
        return (await import(pathToFileURL(modulePath).href));
    }
    return (await import(packageName));
}
function resolveTargetFactory(mod, registryName) {
    const named = mod[registryName];
    if (typeof named === "function") {
        if (named.prototype?.render) {
            const Klass = named;
            return () => new Klass();
        }
        return named;
    }
    const Default = mod.default;
    if (typeof Default === "function") {
        if (Default.prototype?.render) {
            const Klass = Default;
            return () => new Klass();
        }
        return Default;
    }
    throw new Error(`Target package for "${registryName}" must export default class, factory, or named "${registryName}" export`);
}
export async function loadTargetFromPackage(packageName, registryName, rootDir) {
    const meta = readBlockmlPackageMeta(packageName, rootDir);
    const mod = await importPackageModule(packageName, rootDir, meta.target);
    const resolvedName = meta.targetName ?? registryName;
    const loaded = {
        factory: resolveTargetFactory(mod, resolvedName),
        registryName: resolvedName,
    };
    if (meta.cliHints) {
        loaded.hints = meta.cliHints;
    }
    return loaded;
}
//# sourceMappingURL=load-target-plugin.js.map