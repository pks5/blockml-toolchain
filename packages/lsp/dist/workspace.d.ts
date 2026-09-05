import type { BomDocument, Diagnostic } from "@blockml/bom";
import { TypeRegistry } from "@blockml/framework";
/** Globs registered with the client for workspace/didChangeWatchedFiles. */
export declare const WATCH_GLOBS: readonly ["**/*.bml", "**/blockml.config.json", "**/package.json"];
/** True when a disk path should invalidate the cached TypeRegistry. */
export declare function isWorkspaceRefreshPath(filePath: string): boolean;
export interface BomConfig {
    srcDir?: string;
    libraries?: string[];
}
export declare function loadBomConfig(rootDir: string): BomConfig;
/** Walk up from workspace root until node_modules is found (CLI/framework discovery). */
export declare function resolveBootstrapRoot(fromDir: string): string;
/** Read package.json → blockml.library when present (e.g. @blockml/core repo layout). */
export declare function loadPackageBlockmlLibrary(rootDir: string): string | undefined;
export interface WorkspaceState {
    rootDir: string;
    config: BomConfig;
    registry: TypeRegistry;
    bootstrapDiagnostics: Diagnostic[];
}
export declare function invalidateWorkspace(rootDir: string): void;
/** Workspace view with the open document overlaid. Does not mutate the cache. */
export declare function workspaceWithOpenDocument(workspace: WorkspaceState, document: BomDocument): WorkspaceState;
/** Overlay the open buffer when it parses. Falls back to the cached workspace. */
export declare function workspaceForOpenText(workspace: WorkspaceState, text: string, filePath: string): WorkspaceState;
export declare function createWorkspace(rootDir: string): WorkspaceState;
//# sourceMappingURL=workspace.d.ts.map