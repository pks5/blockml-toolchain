export declare const DB_DIR = "lbug";
export declare const MANIFEST_FILE = "manifest.json";
export interface FileFingerprint {
    path: string;
    mtimeMs: number;
    size: number;
}
export interface IndexManifest {
    version: number;
    blocks: number;
    members: number;
    packageJsonHash: string;
    lockfileHash: string;
    files: FileFingerprint[];
}
export declare function defaultIndexDir(rootDir: string): string;
export declare function resolveIndexDir(rootDir: string, indexDir?: string): string;
export declare function resolveDbDir(indexDir: string): string;
export declare function fingerprintProject(rootDir: string): {
    packageJsonHash: string;
    lockfileHash: string;
};
export declare function fingerprintFiles(filePaths: string[]): FileFingerprint[];
export declare function buildManifest(rootDir: string, filePaths: string[], blocks: number, members: number): IndexManifest;
export declare function manifestIsCurrent(manifest: IndexManifest, rootDir: string, srcDir?: string): boolean;
export declare function readManifest(indexDir: string): IndexManifest | undefined;
//# sourceMappingURL=fingerprint.d.ts.map