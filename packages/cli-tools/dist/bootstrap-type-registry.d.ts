import { type BootstrapResult } from "@blockml/framework";
import type { BomConfig } from "./load-config.js";
/** npm @blockml/core Library.bml under the workspace root, if installed. */
export declare function workspaceCoreLibraryPath(wsRoot: string): string | undefined;
/**
 * Whether fatblock workspace-core bootstrap should append npm Core as an extra
 * seed. False when the project identity is already that library (same realpath
 * or same Library type FQN) — Core dogfooding against an installed copy.
 */
export declare function shouldSeedWorkspaceCore(identityPath: string | undefined, corePath: string): boolean;
export interface CliBootstrapOptions {
    config: BomConfig;
    rootDir?: string;
    librariesOverride?: string[];
    srcDirOverride?: string;
    /** When set, used as corpus paths instead of [srcDir]. */
    corpusPaths?: string[];
}
export declare function projectLibrarySeeds(options: Pick<CliBootstrapOptions, "config" | "rootDir" | "librariesOverride">): string[];
/** package.json blockml.library path, if declared. */
export declare function projectIdentityLibraryPath(rootDir: string): string | undefined;
export declare function bootstrapProjectTypeRegistry(options: CliBootstrapOptions): BootstrapResult;
//# sourceMappingURL=bootstrap-type-registry.d.ts.map