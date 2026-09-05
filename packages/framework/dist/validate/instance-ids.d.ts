import type { BlockDefinition, BlockInstance } from "@blockml/bom";
export type InstanceIdLoc = {
    file: string;
    line?: number;
    column?: number;
};
export declare function instanceId(instance: BlockInstance): string | undefined;
export declare function collectDocumentInstanceIds(block: BlockDefinition, file: string): Map<string, InstanceIdLoc>;
export declare function resolveInstanceRef(token: string, ids: Map<string, InstanceIdLoc>): boolean;
//# sourceMappingURL=instance-ids.d.ts.map