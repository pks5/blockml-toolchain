import { type CliOutputLine } from "./cli-style.js";
export interface UpdateProjectOptions {
    rootDir: string;
    /** Skip npm install. Default false, so npm install runs. */
    noInstall?: boolean;
}
export interface UpdateProjectResult {
    code: number;
    lines: CliOutputLine[];
}
export declare function updateProject(options: UpdateProjectOptions): UpdateProjectResult;
//# sourceMappingURL=run-update.d.ts.map