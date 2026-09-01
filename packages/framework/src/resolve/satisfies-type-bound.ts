import type { TypeRegistry } from "../registry/type-registry.js";
import { collectBaseTypeChain } from "./resolve-effective-members.js";

/** G on T's baseType chain, or G ∈ T.contracts[] (direct only). */
export function satisfiesTypeBound(
  typeFqn: string,
  boundFqn: string,
  registry: TypeRegistry,
): boolean {
  if (typeFqn === boundFqn) {
    return true;
  }
  const start = registry.get(typeFqn)?.block;
  if (!start) {
    return false;
  }
  if ((start.contracts ?? []).some((c) => c.value === boundFqn)) {
    return true;
  }
  const chain = collectBaseTypeChain(start, registry);
  if (chain.some((b) => b.type === boundFqn)) {
    return true;
  }
  return chain[0]?.baseType === boundFqn;
}
