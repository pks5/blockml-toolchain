export declare const CONFIG_FILE = "blockml.config.json";
export declare const DEFAULT_SRC_DIR = "blocks";
export declare function readJson(path: string): unknown | undefined;
export declare function canonicalPath(path: string): string;
/** srcDir for a package: blockml.config.json override, else default "blocks". */
export declare function packageSrcDir(packageDir: string): string;
export declare function packageDeclaresLibrary(packageDir: string): boolean;
/** Blocks/srcDir root when the package is a BlockML module; otherwise undefined. */
export declare function blockmlPackageBlocksRoot(packageDir: string): string | undefined;
//# sourceMappingURL=package-paths.d.ts.map