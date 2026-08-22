import type { Diagnostic } from "@blockml/bom";
import { TypeRegistry } from "@blockml/framework";
export interface BomConfig {
    srcDir?: string;
    libraries?: string[];
}
export declare function loadBomConfig(rootDir: string): BomConfig;
export interface WorkspaceState {
    rootDir: string;
    config: BomConfig;
    registry: TypeRegistry;
    bootstrapDiagnostics: Diagnostic[];
}
export declare function invalidateWorkspace(rootDir: string): void;
export declare function createWorkspace(rootDir: string): WorkspaceState;
//# sourceMappingURL=workspace.d.ts.map