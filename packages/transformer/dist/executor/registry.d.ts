import { type TypeRegistry } from "@blockml/framework";
import type { OperationExecutor } from "./operation-executor.js";
export declare class ExecutorRegistry {
    private readonly executors;
    register(operationTypeFqn: string, executor: OperationExecutor): this;
    resolve(typeFqn: string, typeRegistry: TypeRegistry): OperationExecutor;
}
//# sourceMappingURL=registry.d.ts.map