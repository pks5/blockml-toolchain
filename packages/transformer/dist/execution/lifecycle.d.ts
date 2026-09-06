import type { LifecycleStage } from "./constants.js";
export interface ParsedExecutionFqn {
    libraryFqn: string;
    stage: LifecycleStage;
    name: string;
    fqn: string;
}
export declare function isLifecycleStage(value: string): value is LifecycleStage;
export declare function parseExecutionFqn(fqn: string): ParsedExecutionFqn | undefined;
export declare function executionFqn(libraryFqn: string, stage: LifecycleStage, name: string): string;
export declare function lifecyclePackageFqn(libraryFqn: string, stage: LifecycleStage): string;
export declare function padSequence(sequence: number): string;
export declare function formatNameTimestamp(date: Date): string;
/** ISO 8601 local date-time without timezone marker, e.g. 2026-08-30T01:17:02 */
export declare function formatDateTimeProperty(date: Date): string;
export declare function sanitizeBlockName(name: string): string;
export declare function generateExecutionName(sequence: number, originalName: string, startedAt: Date): string;
export declare function executionFilePath(libraryRoot: string, stage: LifecycleStage, name: string): string;
//# sourceMappingURL=lifecycle.d.ts.map