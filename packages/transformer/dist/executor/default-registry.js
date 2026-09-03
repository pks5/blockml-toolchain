import { AGENTIC_OPERATION_FQN } from "../execution/constants.js";
import { AgenticExecutor } from "./agentic-executor.js";
import { ExecutorRegistry } from "./registry.js";
export function createDefaultExecutorRegistry(agent) {
    return new ExecutorRegistry().register(AGENTIC_OPERATION_FQN, new AgenticExecutor(agent));
}
//# sourceMappingURL=default-registry.js.map