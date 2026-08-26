import { clearTargets, registerTarget } from "@blockml/compiler";
import { BlockDocTarget } from "@blockml/blockdoc-target";
import { FatBlockTarget } from "@blockml/fatblock-target";
import { XsdTarget } from "@blockml/xsd-target";
import { isBuiltinTarget, loadTargetFromPackage, resolveTargetPackage, } from "./load-target-plugin.js";
const DEFAULT_TARGETS = ["blockdoc"];
let bootstrapped = false;
const BUILTIN_FACTORIES = {
    blockdoc: () => new BlockDocTarget(),
    xsd: () => new XsdTarget(),
    fatblock: () => new FatBlockTarget(),
};
const BUILTIN_HINTS = {
    blockdoc: {
        defaultOutDir: (config) => config.outDir ?? "blockdoc",
    },
    xsd: {
        defaultOutDir: "schemas",
    },
    fatblock: {
        requiresHostFile: true,
        requiresSrcDir: true,
        documentBootstrap: "workspace-core",
    },
};
const customFactories = new Map();
const customHints = new Map();
export function registerTargetFactory(name, factory, hints) {
    customFactories.set(name, factory);
    if (hints) {
        customHints.set(name, hints);
    }
}
export function getTargetCliHints(name) {
    return customHints.get(name) ?? BUILTIN_HINTS[name];
}
export function getTargetFactory(name) {
    return customFactories.get(name) ?? BUILTIN_FACTORIES[name];
}
export function builtinTargetNames() {
    return Object.keys(BUILTIN_FACTORIES);
}
export async function bootstrapTargets(config, requested = [], rootDir = process.cwd()) {
    if (bootstrapped) {
        return;
    }
    const names = new Set(config.targets?.length ? config.targets : DEFAULT_TARGETS);
    for (const name of requested) {
        names.add(name);
    }
    for (const name of names) {
        if (isBuiltinTarget(name) || customFactories.has(name)) {
            continue;
        }
        const packageName = resolveTargetPackage(config, name);
        if (!packageName) {
            throw new Error(`Unknown target in targets[]: ${name}`);
        }
        const loaded = await loadTargetFromPackage(packageName, name, rootDir);
        customFactories.set(loaded.registryName, loaded.factory);
        if (loaded.hints) {
            customHints.set(loaded.registryName, loaded.hints);
        }
    }
    for (const name of names) {
        const factory = getTargetFactory(name);
        if (!factory) {
            throw new Error(`Unknown target in targets[]: ${name}`);
        }
        registerTarget(factory());
    }
    bootstrapped = true;
}
export function resetBootstrapTargets() {
    bootstrapped = false;
    customFactories.clear();
    customHints.clear();
    clearTargets();
}
//# sourceMappingURL=bootstrap-targets.js.map