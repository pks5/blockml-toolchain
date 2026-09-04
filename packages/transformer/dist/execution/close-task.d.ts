import type { BlockDefinition, BlockInstance } from "@blockml/bom";
import { type ExpressionScope } from "@blockml/framework";
export declare function getOperationTaskInstances(operation: BlockInstance): BlockInstance[];
export declare function closeTaskInstance(instance: BlockInstance, scope: ExpressionScope): BlockInstance;
export declare function emitClosedTaskSnippet(instances: BlockInstance[]): string;
export declare function closeOperationTask(operation: BlockInstance, transformation: BlockDefinition): string;
//# sourceMappingURL=close-task.d.ts.map