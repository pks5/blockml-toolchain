export class AgenticExecutor {
    agent;
    constructor(agent) {
        this.agent = agent;
    }
    async execute(request) {
        const result = await this.agent.execute({
            workspaceRoot: request.workspaceRoot,
            executionFqn: request.executionFqn,
            operationIndex: request.operationIndex,
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
//# sourceMappingURL=agentic-executor.js.map