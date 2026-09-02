import { Database, Connection } from "@ladybugdb/core";
import type { GraphData } from "./mapper.js";
import type { GraphStore } from "./store.js";
export declare class LadybugStore implements GraphStore {
    private readonly database;
    private readonly connection;
    private closed;
    constructor(database: Database, connection: Connection);
    exec(cypher: string, params?: Record<string, unknown>): Promise<unknown[][]>;
    execWithColumns(cypher: string, params?: Record<string, unknown>): Promise<{
        columns: string[];
        rows: unknown[][];
    }>;
    close(): Promise<void>;
}
export declare function openLadybugStore(databasePath: string): Promise<LadybugStore>;
export declare function createLadybugStore(databasePath: string): Promise<LadybugStore>;
export declare function populateStore(store: LadybugStore, data: GraphData): Promise<void>;
//# sourceMappingURL=ladybug-store.d.ts.map