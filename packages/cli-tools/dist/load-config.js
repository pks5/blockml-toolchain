import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
const DEFAULT_CONFIG = {
    outDir: "doc",
    srcDir: "src",
    targets: ["blockdoc"],
    defaultTarget: "blockdoc",
};
export function loadConfig(cwd = process.cwd()) {
    const configPath = resolve(cwd, "bom.config.json");
    if (!existsSync(configPath)) {
        return { ...DEFAULT_CONFIG };
    }
    const raw = readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw);
    return {
        ...DEFAULT_CONFIG,
        ...parsed,
        targets: parsed.targets?.length ? parsed.targets : DEFAULT_CONFIG.targets,
        defaultTarget: parsed.defaultTarget ?? DEFAULT_CONFIG.defaultTarget,
    };
}
//# sourceMappingURL=load-config.js.map