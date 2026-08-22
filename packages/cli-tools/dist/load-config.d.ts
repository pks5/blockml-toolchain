export interface BomConfig {
    outDir?: string;
    srcDir?: string;
    libraries?: string[];
    targets?: string[];
    targetOptions?: Record<string, unknown>;
    /** Default true when unset. Set false to skip authoring XSD validation on validate. */
    xsdValidation?: boolean;
}
export declare function loadConfig(cwd?: string): BomConfig;
//# sourceMappingURL=load-config.d.ts.map