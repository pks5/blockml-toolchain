import { registerTarget } from "@blockml/compiler";
import { BlockDocTarget } from "@blockml/blockdoc-target";
const DEFAULT_TARGETS = ["blockdoc"];
let bootstrapped = false;
const TARGET_FACTORIES = {
    blockdoc: () => new BlockDocTarget(),
};
export function bootstrapTargets(config) {
    if (bootstrapped) {
        return;
    }
    const names = config.targets?.length ? config.targets : DEFAULT_TARGETS;
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