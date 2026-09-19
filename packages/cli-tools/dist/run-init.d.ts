import { type CliOutputLine } from "./cli-style.js";
export interface InitCliArgs {
    initFqn?: string;
    install?: boolean;
    srcDir?: string;
}
export declare function isValidPackageFqn(fqn: string): boolean;
export declare function runInit(parsed: InitCliArgs, rootDir: string, lines: CliOutputLine[], usage: string): number;
//# sourceMappingURL=run-init.d.ts.map