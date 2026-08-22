import type { TypeRegistry } from "./type-registry.js";
/** Root FQN per file: registry key not prefixed by another key from the same file. */
export declare function rootFqnByFilePath(registry: TypeRegistry): Map<string, string>;
export declare function rootFqns(registry: TypeRegistry): string[];
//# sourceMappingURL=root-fqn.d.ts.map