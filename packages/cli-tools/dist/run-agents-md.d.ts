import { type CliOutputLine } from "./cli-style.js";
export interface GenerateAgentsMdOptions {
    rootDir: string;
    /** Project source folder. Default "blocks". */
    srcDir?: string;
}
export interface GenerateAgentsMdResult {
    code: number;
    lines: CliOutputLine[];
    sectionCount: number;
}
export interface AgentsSection {
    title: string;
    content: string;
}
export declare function renderAgentsMarkdown(sections: AgentsSection[], rules?: string[]): string;
export declare function generateAgentsMd(options: GenerateAgentsMdOptions): GenerateAgentsMdResult;
//# sourceMappingURL=run-agents-md.d.ts.map