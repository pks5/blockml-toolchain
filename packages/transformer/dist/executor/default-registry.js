import { AGENTIC_OPERATION_FQN, TOOL_OPERATION_FQN, } from "../execution/constants.js";
import { AgenticExecutor } from "./agentic-executor.js";
import { ExecutorRegistry } from "./registry.js";
import { ToolExecutor } from "./tool-executor.js";
export function createDefaultExecutorRegistry(agent) {
    return new ExecutorRegistry()
        .register(AGENTIC_OPERATION_FQN, new AgenticExecutor(agent))
        .register(TOOL_OPERATION_FQN, new ToolExecutor());
}
//# sourceMappingURL=default-registry.js.map