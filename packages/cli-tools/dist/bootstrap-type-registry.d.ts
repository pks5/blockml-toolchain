import { type BootstrapResult } from "@blockml/framework";
import type { BomConfig } from "./load-config.js";
export interface CliBootstrapOptions {
    config: BomConfig;
    rootDir?: string;
    librariesOverride?: string[];
    srcDirOverride?: string;
    /** When set, used as corpus paths instead of [srcDir]. */
    corpusPaths?: string[];
}
export declare function projectLibrarySeeds(options: Pick<CliBootstrapOptions, "config" | "rootDir" | "librariesOverride">): string[];
export declare function bootstrapProjectTypeRegistry(options: CliBootstrapOptions): BootstrapResult;
//# sourceMappingURL=bootstrap-type-registry.d.ts.map