import type { RenderTarget } from "@blockml/compiler";
import type { BomConfig } from "./load-config.js";
export interface TargetCliHints {
    defaultOutDir?: string | ((config: BomConfig) => string);
    requiresHostFile?: boolean;
    requiresSrcDir?: boolean;
    documentBootstrap?: "project" | "workspace-core";
    /** When file is omitted, use package.json blockml.library as the host. */
    defaultHostFromPackageLibrary?: boolean;
    /** When --src is omitted, use the host file's directory as the candidate pool. */
    defaultSrcFromHostDir?: boolean;
}
export declare function isBuiltinTarget(name: string): boolean;
export declare function resolveTargetPackage(config: BomConfig, name: string): string | undefined;
export declare function loadTargetFromPackage(packageName: string, registryName: string, rootDir: string): Promise<{
    factory: () => RenderTarget;
    registryName: string;
    hints?: TargetCliHints;
}>;
//# sourceMappingURL=load-target-plugin.d.ts.map