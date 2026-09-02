import { inspectProject } from "@blockml/inspect";
import { pushLines } from "./cli-style.js";
import { suggestMatchingFqn, unknownFqnMessage } from "./suggest-fqn.js";
export async function runInspect(parsed, rootDir, config, lines, usage) {
    const fqn = parsed.inspectFqn?.trim() ?? "";
    if (!fqn) {
        pushLines(lines, "Specify a Block FQN.", "error");
        pushLines(lines, usage, "info");
        return 2;
    }
    const result = inspectProject(fqn, {
        rootDir,
        ...(parsed.srcDir !== undefined || config.srcDir !== undefined
            ? { srcDir: parsed.srcDir ?? config.srcDir }
            : {}),
        ...(parsed.libraries !== undefined || config.libraries !== undefined
            ? { libraries: parsed.libraries ?? config.libraries }
            : {}),
        ...(parsed.depth !== undefined ? { depth: parsed.depth } : {}),
    });
    if (!result.blocks[fqn] && result.unresolved.includes(fqn)) {
        const suggestion = await suggestMatchingFqn(fqn, {
            rootDir,
            ...(parsed.srcDir !== undefined || config.srcDir !== undefined
                ? { srcDir: parsed.srcDir ?? config.srcDir }
                : {}),
            ...(parsed.libraries !== undefined || config.libraries !== undefined
                ? { libraries: parsed.libraries ?? config.libraries }
                : {}),
        });
        pushLines(lines, unknownFqnMessage(fqn, suggestion), "error");
        return 2;
    }
    pushLines(lines, JSON.stringify(result, null, 2), "info");
    return 0;
}
//# sourceMappingURL=run-inspect.js.map