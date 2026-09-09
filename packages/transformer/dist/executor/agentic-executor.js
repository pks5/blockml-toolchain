import { bootstrapFullProjectRegistry } from "@blockml/framework";
import { closeOperationTask } from "../execution/close-task.js";
import { TransformError } from "../execution/errors.js";
import { getEffectiveOperationText, getOperationInstance, } from "../execution/properties.js";
export class AgenticExecutor {
    agent;
    constructor(agent) {
        this.agent = agent;
    }
    async execute(request) {
        const closed = closeAgenticWork(request);
        const result = await this.agent.execute({
            workspaceRoot: request.workspaceRoot,
            taskSnippet: closed.taskSnippet,
            metaPrompt: closed.metaPrompt,
        });
        if (!result.success) {
            return {
                success: false,
                exitCode: result.exitCode,
                error: result.error,
            };
        }
        return {
            success: true,
            ...(result.stdout !== undefined ? { output: result.stdout } : {}),
        };
    }
}
function closeAgenticWork(request) {
    const { registry } = bootstrapFullProjectRegistry({
        rootDir: request.workspaceRoot,
    });
    const document = registry.get(request.executionFqn);
    if (!document) {
        throw new TransformError("execution", `Running ModelTransformation ${request.executionFqn} was not found`);
    }
    const operation = getOperationInstance(document.block, request.operationIndex, registry);
    if (!operation) {
        throw new TransformError("execution", `Running ModelTransformation has no ModelOperation at index ${request.operationIndex}`);
    }
    return {
        taskSnippet: closeOperationTask(operation, document.block),
        metaPrompt: getEffectiveOperationText(operation, "metaPrompt", registry) ?? "",
    };
}
//# sourceMappingURL=agentic-executor.js.map