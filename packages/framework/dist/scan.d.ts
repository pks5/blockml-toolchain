import type { TypeRegistry } from "./registry/type-registry.js";
export type ScanResult = {
    ok: true;
    hits: string[];
} | {
    ok: false;
    message: string;
};
export declare function typeCandidates(registry: TypeRegistry): string[];
export declare function packageCandidates(registry: TypeRegistry): string[];
export declare function scanTypes(selectors: string[], registry: TypeRegistry): ScanResult;
export declare function scanPackages(selectors: string[], registry: TypeRegistry): ScanResult;
//# sourceMappingURL=scan.d.ts.map