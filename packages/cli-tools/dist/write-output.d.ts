import type { RenderOutput, RenderOutputFile } from "@blockml/compiler";
export interface WriteOutputOptions {
    cleanOutDir?: boolean;
    rootFiles?: RenderOutputFile[];
}
export declare function writeOutputFiles(output: RenderOutput, outDir: string, rootDir?: string, options?: WriteOutputOptions): void;
//# sourceMappingURL=write-output.d.ts.map