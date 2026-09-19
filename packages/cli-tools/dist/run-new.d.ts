import { type CliOutputLine } from "./cli-style.js";
import type { BomConfig } from "./load-config.js";
export { locateOwningLibrary } from "@blockml/framework";
export interface NewCliArgs {
    newFqn?: string;
    newBaseType?: string;
    newIs?: string;
    srcDir?: string;
    libraries?: string[];
}
export declare function isValidBlockFqn(fqn: string): boolean;
export declare function destinationPathForNew(fqn: string, owning: {
    libraryFile: string;
    packageFqn: string;
} | undefined, rootDir: string, srcDir: string): string;
export declare function runNew(parsed: NewCliArgs, rootDir: string, config: BomConfig, lines: CliOutputLine[], usage: string): number;
//# sourceMappingURL=run-new.d.ts.map