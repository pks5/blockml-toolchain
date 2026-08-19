import type { Diagnostic } from "@blockml/bom";
import { TypeRegistry } from "./type-registry.js";
export declare function defaultBootstrapPaths(rootDir?: string): string[];
export interface BootstrapResult {
    registry: TypeRegistry;
    diagnostics: Diagnostic[];
}
export declare function bootstrapTypeRegistry(paths: string[], rootDir?: string): BootstrapResult;
//# sourceMappingURL=bootstrap.d.ts.map