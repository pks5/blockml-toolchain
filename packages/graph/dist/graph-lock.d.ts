export declare const INDEX_LOCK_FILE = "index.lock";
export declare function isLadybugLockError(error: unknown): boolean;
export declare function delay(ms: number): Promise<void>;
export declare function withLadybugLockRetry<T>(run: () => Promise<T>): Promise<T>;
export declare function acquireGraphLock(indexDir: string): Promise<() => Promise<void>>;
//# sourceMappingURL=graph-lock.d.ts.map