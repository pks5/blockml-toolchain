export interface BomConfig {
    outDir?: string;
    srcDir?: string;
    libraries?: string[];
    targets?: string[];
    /** Registry name → npm package for dynamic target plugin loading. */
    targetPackages?: Record<string, string>;
    targetOptions?: Record<string, unknown>;
    /** Default compile target when omitted on CLI. Default "blockdoc". */
    defaultTarget?: string;
    /** Default true when unset. Set false to skip authoring XSD validation on validate. */
    xsdValidation?: boolean;
}
export declare function loadConfig(cwd?: string): BomConfig;
//# sourceMappingURL=load-config.d.ts.map