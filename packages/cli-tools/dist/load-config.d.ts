export interface BomConfig {
    outDir?: string;
    srcDir?: string;
    libraries?: string[];
    targets?: string[];
    targetOptions?: Record<string, unknown>;
}
export declare function loadConfig(cwd?: string): BomConfig;
//# sourceMappingURL=load-config.d.ts.map