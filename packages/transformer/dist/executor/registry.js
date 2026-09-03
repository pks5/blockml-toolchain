import { collectBaseTypeChain } from "@blockml/framework";
import { MODEL_OPERATION_FQN } from "../execution/constants.js";
import { TransformError } from "../execution/errors.js";
export class ExecutorRegistry {
    executors = new Map();
    register(operationTypeFqn, executor) {
        this.executors.set(operationTypeFqn, executor);
        return this;
    }
    resolve(typeFqn, typeRegistry) {
        if (typeFqn === MODEL_OPERATION_FQN) {
            throw new TransformError("execution", `Cannot execute abstract ${MODEL_OPERATION_FQN}; use a concrete subtype`);
        }
        const registered = this.executors.get(typeFqn);
        if (registered) {
            return registered;
        }
        const start = typeRegistry.get(typeFqn)?.block;
        if (!start) {
            throw new TransformError("execution", `No OperationExecutor registered for ${typeFqn}`);
        }
        const chain = collectBaseTypeChain(start, typeRegistry);
        for (let index = chain.length - 1; index >= 0; index--) {
            const candidate = chain[index].type;
            if (candidate === MODEL_OPERATION_FQN) {
                continue;
            }
            const executor = this.executors.get(candidate);
            if (executor) {
                return executor;
            }
        }
        throw new TransformError("execution", `No OperationExecutor registered for ${typeFqn}`);
    }
}
//# sourceMappingURL=registry.js.map