import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { bootstrapTypeRegistry } from "@blockml/framework";
import { pushLines } from "./cli-style.js";
const AGENT_INSTRUCTIONS_FQN = "org.blockml.bml.core.AgentInstructions";
const RULES_AGGREGATION = "rules";
const DEFAULT_ORDER = 1000;
const CONFIG_FILE = "blockml.config.json";
const DEFAULT_SRC_DIR = "blocks";
export function renderAgentsMarkdown(sections, rules = []) {
    const parts = sections.map((section) => {
        const heading = `# ${section.title}`.trimEnd();
        const body = section.content.trimEnd();
        return body.length > 0 ? `${heading}\n\n${body}` : heading;
    });
    const items = rules.map(ruleItem).filter((item) => item !== "-");
    if (items.length > 0) {
        parts.push(`# ${streamHeading(RULES_AGGREGATION)}\n\n${items.join("\n")}`);
    }
    if (parts.length === 0) {
        return "";
    }
    return `${parts.join("\n\n")}\n`;
}
function streamHeading(aggregationName) {
    if (aggregationName.length === 0) {
        return aggregationName;
    }
    return aggregationName.charAt(0).toUpperCase() + aggregationName.slice(1);
}
function ruleItem(content) {
    const body = content.trimEnd();
    if (body.length === 0) {
        return "-";
    }
    return body
        .split("\n")
        .map((line, index) => (index === 0 ? `- ${line}` : `  ${line}`))
        .join("\n");
}
export function generateAgentsMd(options) {
    const lines = [];
    const rootDir = options.rootDir;
    const srcDir = options.srcDir?.trim() || DEFAULT_SRC_DIR;
    const agentsPath = join(rootDir, "AGENTS.md");
    const fragments = collectInstructionFragments(rootDir, srcDir);
    const sections = fragments.flatMap((fragment) => fragment.sections);
    const rules = fragments.flatMap((fragment) => fragment.rules);
    if (sections.length === 0 && rules.length === 0) {
        pushLines(lines, "No AgentInstructions blocks found.", "error");
        return { code: 1, lines, sectionCount: 0 };
    }
    const existed = existsSync(agentsPath);
    writeFileSync(agentsPath, renderAgentsMarkdown(sections, rules), "utf8");
    pushLines(lines, `${existed ? "Updated" : "Created"} AGENTS.md`, "info");
    return { code: 0, lines, sectionCount: sections.length + rules.length };
}
function collectInstructionFragments(rootDir, srcDir) {
    const paths = corpusRoots(rootDir, srcDir);
    const { registry } = bootstrapTypeRegistry({ rootDir, paths });
    const fragments = [];
    for (const fqn of registry.keys()) {
        const block = registry.get(fqn)?.block;
        if (!block || !descendsFromAgentInstructions(block, registry)) {
            continue;
        }
        fragments.push({
            fqn: block.type,
            order: readOrder(block, registry),
            sections: authoredSections(block),
            rules: authoredRules(block).filter((rule) => rule.trim().length > 0),
        });
    }
    fragments.sort((a, b) => a.order - b.order || a.fqn.localeCompare(b.fqn));
    return fragments;
}
function descendsFromAgentInstructions(start, registry) {
    if (start.type === AGENT_INSTRUCTIONS_FQN) {
        return false;
    }
    const visited = new Set();
    let current = start;
    while (current && !visited.has(current.type)) {
        visited.add(current.type);
        const base = current.baseType;
        if (!base) {
            return false;
        }
        if (base === AGENT_INSTRUCTIONS_FQN) {
            return true;
        }
        current = registry.get(base)?.block;
    }
    return false;
}
function readOrder(start, registry) {
    const visited = new Set();
    let current = start;
    while (current && !visited.has(current.type)) {
        visited.add(current.type);
        const prop = current.members.find((member) => member.kind === "property" && member.name === "order");
        if (prop?.kind === "property") {
            const order = propertyNumber(prop);
            if (order !== undefined) {
                return order;
            }
        }
        const base = current.baseType;
        if (!base) {
            break;
        }
        current = registry.get(base)?.block;
    }
    return DEFAULT_ORDER;
}
function propertyNumber(prop) {
    const direct = literalNumber(prop.value);
    if (direct !== undefined) {
        return direct;
    }
    for (const entry of prop.values ?? []) {
        const nested = literalNumber(entry.value);
        if (nested !== undefined) {
            return nested;
        }
    }
    return undefined;
}
function authoredSections(block) {
    const aggregation = block.members.find((member) => member.kind === "aggregation" && member.name === "sections");
    if (!aggregation || aggregation.kind !== "aggregation" || !aggregation.composition) {
        return [];
    }
    const sections = [];
    for (const child of aggregation.composition.children) {
        if (child.kind !== "blockInstance") {
            continue;
        }
        sections.push({
            title: literalText(child.instance.memberValues.title),
            content: literalText(child.instance.memberValues.content),
        });
    }
    return sections;
}
function authoredRules(block) {
    const aggregation = block.members.find((member) => member.kind === "aggregation" && member.name === RULES_AGGREGATION);
    if (!aggregation || aggregation.kind !== "aggregation" || !aggregation.composition) {
        return [];
    }
    const rules = [];
    for (const child of aggregation.composition.children) {
        if (child.kind !== "blockInstance") {
            continue;
        }
        rules.push(literalText(child.instance.memberValues.content));
    }
    return rules;
}
function literalText(value) {
    if (!value) {
        return "";
    }
    if (value.kind === "literal") {
        return value.value == null ? "" : String(value.value);
    }
    if (value.kind === "interpolated") {
        return value.raw;
    }
    return "";
}
function literalNumber(value) {
    if (!value || value.kind !== "literal") {
        return undefined;
    }
    if (typeof value.value === "number" && Number.isFinite(value.value)) {
        return value.value;
    }
    if (typeof value.value === "string" && value.value.trim() !== "") {
        const parsed = Number(value.value);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return undefined;
}
function corpusRoots(rootDir, srcDir) {
    const seen = new Set();
    const roots = [];
    const add = (path) => {
        const abs = resolve(path);
        let key = abs;
        try {
            key = realpathSync(abs);
        }
        catch {
            // Missing directories still identify a corpus root.
        }
        if (seen.has(key)) {
            return;
        }
        seen.add(key);
        roots.push(abs);
    };
    add(resolve(rootDir, srcDir));
    for (const blocksRoot of directDependencyBlocksRoots(rootDir)) {
        add(blocksRoot);
    }
    return roots;
}
function directDependencyBlocksRoots(rootDir) {
    const pkg = readJson(join(rootDir, "package.json"));
    const names = [
        ...Object.keys(pkg?.dependencies ?? {}),
        ...Object.keys(pkg?.devDependencies ?? {}),
    ];
    const roots = [];
    for (const name of names) {
        const installed = resolveInstalledPackageDir(name, rootDir);
        if (!installed) {
            continue;
        }
        const blocksRoot = blockmlPackageBlocksRoot(installed);
        if (blocksRoot) {
            roots.push(blocksRoot);
        }
    }
    return roots;
}
function resolveInstalledPackageDir(packageName, fromDir) {
    for (const dir of ancestorDirs(fromDir)) {
        const candidate = join(dir, "node_modules", packageName);
        if (existsSync(join(candidate, "package.json"))) {
            return candidate;
        }
    }
    return undefined;
}
function ancestorDirs(fromDir) {
    const dirs = [];
    let dir = resolve(fromDir);
    for (;;) {
        dirs.push(dir);
        const parent = dirname(dir);
        if (parent === dir) {
            return dirs;
        }
        dir = parent;
    }
}
function blockmlPackageBlocksRoot(packageDir) {
    if (!isBlockmlPackage(packageDir)) {
        return undefined;
    }
    return packageSrcDir(packageDir);
}
function isBlockmlPackage(packageDir) {
    const pkg = readJson(join(packageDir, "package.json"));
    const library = pkg?.blockml?.library;
    if (typeof library === "string" && library.length > 0) {
        return true;
    }
    return existsSync(join(packageDir, CONFIG_FILE));
}
function packageSrcDir(packageDir) {
    const configPath = join(packageDir, CONFIG_FILE);
    if (existsSync(configPath)) {
        const cfg = readJson(configPath);
        if (typeof cfg?.srcDir === "string" && cfg.srcDir.length > 0) {
            return resolve(packageDir, cfg.srcDir);
        }
    }
    return resolve(packageDir, DEFAULT_SRC_DIR);
}
function readJson(path) {
    try {
        return JSON.parse(readFileSync(path, "utf8"));
    }
    catch {
        return undefined;
    }
}
//# sourceMappingURL=run-agents-md.js.map