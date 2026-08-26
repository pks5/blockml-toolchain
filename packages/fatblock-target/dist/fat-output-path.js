/** Output basename: host FQN + ".fat.bml". */
export function fatOutputBasename(hostFqn) {
    const fqn = hostFqn.trim();
    if (!fqn) {
        return "unnamed.fat.bml";
    }
    return `${fqn}.fat.bml`;
}
//# sourceMappingURL=fat-output-path.js.map