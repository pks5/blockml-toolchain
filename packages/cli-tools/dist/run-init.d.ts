import { type CliOutputLine } from "./cli-style.js";
export interface InitProjectOptions {
    packageFqn: string;
    rootDir: string;
    /** Source folder under rootDir. Default "blocks". */
    srcDir?: string;
    /** Run npm install after writes. Default false. */
    install?: boolean;
}
export interface InitProjectResult {
    code: number;
    lines: CliOutputLine[];
}
export declare function isValidPackageFqn(fqn: string): boolean;
export declare function initProject(options: InitProjectOptions): InitProjectResult;
//# sourceMappingURL=run-init.d.ts.map