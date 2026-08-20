import { registerTarget } from "@blockml/compiler";
import { BlockDocTarget } from "@blockml/blockdoc-target";
import { FatBlockTarget } from "@blockml/fatblock-target";
import { XsdTarget } from "@blockml/xsd-target";
const DEFAULT_TARGETS = ["blockdoc"];
let bootstrapped = false;
const TARGET_FACTORIES = {
    blockdoc: () => new BlockDocTarget(),
    xsd: () => new XsdTarget(),
    fatblock: () => new FatBlockTarget(),
};
export function bootstrapTargets(config, requested = []) {
    if (bootstrapped) {
        return;
    }
    const names = new Set(config.targets?.length ? config.targets : DEFAULT_TARGETS);
    for (const name of requested) {
        names.add(name);
    }
    for (const name of names) {
        const factory = TARGET_FACTORIES[name];
        if (!factory) {
            throw new Error(`Unknown target in targets[]: ${name}`);
        }
        registerTarget(factory());
    }
    bootstrapped = true;
}
export function resetBootstrapTargets() {
    bootstrapped = false;
}
//# sourceMappingURL=bootstrap-targets.js.map