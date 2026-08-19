import type { Diagnostic } from "@blockml/bom";
import { TypeRegistry } from "./type-registry.js";
export interface BootstrapOptions {
    /** Corpus roots for flat scan mode. */
    paths?: string[];
    /** Library.bml entry points for library graph mode. */
    libraryPaths?: string[];
    /** Working directory for relative paths. */
    rootDir?: string;
}
export declare function defaultBootstrapPaths(rootDir?: string): string[];
export interface BootstrapResult {
    registry: TypeRegistry;
    diagnostics: Diagnostic[];
}
export declare function bootstrapTypeRegistry(optionsOrPaths?: BootstrapOptions | string[], rootDirArg?: string): BootstrapResult;
//# sourceMappingURL=bootstrap.d.ts.map