import type { TypeRegistry } from "@blockml/framework";
/** Root FQN per file: the registry key not prefixed by another key from the same file. */
export declare function rootFqnsByFilePath(registry: TypeRegistry): Map<string, string>;
export declare function collectCandidateFqns(registry: TypeRegistry, srcDir: string, rootDir: string, hostFqn: string, includePatterns?: string[]): {
    fqns: string[];
    hostFilePath?: string;
};
//# sourceMappingURL=collect-candidates.d.ts.map