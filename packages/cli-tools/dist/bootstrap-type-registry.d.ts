import { type BootstrapResult } from "@blockml/framework";
import type { BomConfig } from "./load-config.js";
export interface CliBootstrapOptions {
    config: BomConfig;
    rootDir?: string;
    librariesOverride?: string[];
    srcDirOverride?: string;
}
export declare function bootstrapProjectTypeRegistry(options: CliBootstrapOptions): BootstrapResult;
//# sourceMappingURL=bootstrap-type-registry.d.ts.map