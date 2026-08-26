/** Output basename: host FQN + ".fat.bml". */
export function fatOutputBasename(hostFqn: string): string {
  const fqn = hostFqn.trim();
  if (!fqn) {
    return "unnamed.fat.bml";
  }
  return `${fqn}.fat.bml`;
}
