import type { BomDocument } from "@blockml/bom";
import { type TypeRegistry } from "@blockml/framework";
import type { StartedExecution } from "./start.js";
export interface LoadedRunningExecution {
    document: BomDocument;
    registry: TypeRegistry;
}
export declare function loadRunningExecution(workspaceRoot: string, started: StartedExecution): LoadedRunningExecution;
//# sourceMappingURL=load-running.d.ts.map