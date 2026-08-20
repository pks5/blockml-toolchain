const targets = new Map();
export function registerTarget(target) {
    targets.set(target.name, target);
}
export function getTarget(name) {
    return targets.get(name);
}
export function clearTargets() {
    targets.clear();
}
export function registeredTargetNames() {
    return [...targets.keys()];
}
//# sourceMappingURL=target-registry.js.map