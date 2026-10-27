import { type CliOutputLine } from "./cli-style.js";
export interface InitProjectOptions {
    packageFqn: string;
    rootDir: string;
    /** Source folder under rootDir. Default "blocks". */
    srcDir?: string;
    /** Skip npm install and AGENTS.md generation. Default false, so both run. */
    noInstall?: boolean;
}
export interface InitProjectResult {
    code: number;
    lines: CliOutputLine[];
}
export declare function isValidPackageFqn(fqn: string): boolean;
export declare function readCliPackageJson(): {
    version: string;
    coreRange: string;
};
export declare function initProject(options: InitProjectOptions): InitProjectResult;
//# sourceMappingURL=run-init.d.ts.map