import type { RenderOutput, RenderOutputFile } from "@blockml/compiler";
export interface WriteOutputOptions {
    cleanOutDir?: boolean;
    /** Legacy override; prefer output.rootFiles from RenderOutput. */
    rootFiles?: RenderOutputFile[];
}
export interface WriteOutputResult {
    filesWritten: number;
    rootFilesWritten: string[];
}
export declare function writeOutputFiles(output: RenderOutput, outDir: string, rootDir?: string, options?: WriteOutputOptions): WriteOutputResult;
//# sourceMappingURL=write-output.d.ts.map