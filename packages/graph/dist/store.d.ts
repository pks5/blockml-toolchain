export interface GraphStore {
    exec(cypher: string, params?: Record<string, unknown>): Promise<unknown[][]>;
    execWithColumns(cypher: string, params?: Record<string, unknown>): Promise<{
        columns: string[];
        rows: unknown[][];
    }>;
    close(): Promise<void>;
}
export declare const MEMORY_DB_PATH = ":memory:";
//# sourceMappingURL=store.d.ts.map