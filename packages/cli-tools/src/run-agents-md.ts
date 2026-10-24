import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { BlockDefinition, MemberValue, PropertyDefinition } from "@blockml/bom";
import { bootstrapTypeRegistry, type TypeRegistry } from "@blockml/framework";
import { pushLines, type CliOutputLine } from "./cli-style.js";

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

interface InstructionFragment {
  fqn: string;
  order: number;
  sections: AgentsSection[];
  rules: string[];
}

const AGENT_INSTRUCTIONS_FQN = "org.blockml.bml.core.AgentInstructions";
const RULES_AGGREGATION = "rules";
const DEFAULT_ORDER = 1000;
const CONFIG_FILE = "blockml.config.json";
const DEFAULT_SRC_DIR = "blocks";

export function renderAgentsMarkdown(sections: AgentsSection[], rules: string[] = []): string {
  const parts: string[] = sections.map((section) => {
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

function streamHeading(aggregationName: string): string {
  if (aggregationName.length === 0) {
    return aggregationName;
  }
  return aggregationName.charAt(0).toUpperCase() + aggregationName.slice(1);
}

function ruleItem(content: string): string {
  const body = content.trimEnd();
  if (body.length === 0) {
    return "-";
  }
  return body
    .split("\n")
    .map((line, index) => (index === 0 ? `- ${line}` : `  ${line}`))
    .join("\n");
}

export function generateAgentsMd(options: GenerateAgentsMdOptions): GenerateAgentsMdResult {
  const lines: CliOutputLine[] = [];
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

function collectInstructionFragments(rootDir: string, srcDir: string): InstructionFragment[] {
  const paths = corpusRoots(rootDir, srcDir);
  const { registry } = bootstrapTypeRegistry({ rootDir, paths });
  const fragments: InstructionFragment[] = [];
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

function descendsFromAgentInstructions(start: BlockDefinition, registry: TypeRegistry): boolean {
  if (start.type === AGENT_INSTRUCTIONS_FQN) {
    return false;
  }
  const visited = new Set<string>();
  let current: BlockDefinition | undefined = start;
  while (current && !visited.has(current.type)) {
    visited.add(current.type);
    const base: string | undefined = current.baseType;
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

function readOrder(start: BlockDefinition, registry: TypeRegistry): number {
  const visited = new Set<string>();
  let current: BlockDefinition | undefined = start;
  while (current && !visited.has(current.type)) {
    visited.add(current.type);
    const prop = current.members.find(
      (member) => member.kind === "property" && member.name === "order",
    );
    if (prop?.kind === "property") {
      const order = propertyNumber(prop);
      if (order !== undefined) {
        return order;
      }
    }
    const base: string | undefined = current.baseType;
    if (!base) {
      break;
    }
    current = registry.get(base)?.block;
  }
  return DEFAULT_ORDER;
}

function propertyNumber(prop: PropertyDefinition): number | undefined {
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

function authoredSections(block: BlockDefinition): AgentsSection[] {
  const aggregation = block.members.find(
    (member) => member.kind === "aggregation" && member.name === "sections",
  );
  if (!aggregation || aggregation.kind !== "aggregation" || !aggregation.composition) {
    return [];
  }
  const sections: AgentsSection[] = [];
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

function authoredRules(block: BlockDefinition): string[] {
  const aggregation = block.members.find(
    (member) => member.kind === "aggregation" && member.name === RULES_AGGREGATION,
  );
  if (!aggregation || aggregation.kind !== "aggregation" || !aggregation.composition) {
    return [];
  }
  const rules: string[] = [];
  for (const child of aggregation.composition.children) {
    if (child.kind !== "blockInstance") {
      continue;
    }
    rules.push(literalText(child.instance.memberValues.content));
  }
  return rules;
}

function literalText(value: MemberValue | undefined): string {
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

function literalNumber(value: MemberValue | undefined): number | undefined {
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

function corpusRoots(rootDir: string, srcDir: string): string[] {
  const seen = new Set<string>();
  const roots: string[] = [];
  const add = (path: string) => {
    const abs = resolve(path);
    let key = abs;
    try {
      key = realpathSync(abs);
    } catch {
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

function directDependencyBlocksRoots(rootDir: string): string[] {
  const pkg = readJson(join(rootDir, "package.json")) as
    | {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      }
    | undefined;
  const names = [
    ...Object.keys(pkg?.dependencies ?? {}),
    ...Object.keys(pkg?.devDependencies ?? {}),
  ];
  const roots: string[] = [];
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

function resolveInstalledPackageDir(packageName: string, fromDir: string): string | undefined {
  for (const dir of ancestorDirs(fromDir)) {
    const candidate = join(dir, "node_modules", packageName);
    if (existsSync(join(candidate, "package.json"))) {
      return candidate;
    }
  }
  return undefined;
}

function ancestorDirs(fromDir: string): string[] {
  const dirs: string[] = [];
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

function blockmlPackageBlocksRoot(packageDir: string): string | undefined {
  if (!isBlockmlPackage(packageDir)) {
    return undefined;
  }
  return packageSrcDir(packageDir);
}

function isBlockmlPackage(packageDir: string): boolean {
  const pkg = readJson(join(packageDir, "package.json")) as
    | { blockml?: { library?: string } }
    | undefined;
  const library = pkg?.blockml?.library;
  if (typeof library === "string" && library.length > 0) {
    return true;
  }
  return existsSync(join(packageDir, CONFIG_FILE));
}

function packageSrcDir(packageDir: string): string {
  const configPath = join(packageDir, CONFIG_FILE);
  if (existsSync(configPath)) {
    const cfg = readJson(configPath) as { srcDir?: string } | undefined;
    if (typeof cfg?.srcDir === "string" && cfg.srcDir.length > 0) {
      return resolve(packageDir, cfg.srcDir);
    }
  }
  return resolve(packageDir, DEFAULT_SRC_DIR);
}

function readJson(path: string): unknown | undefined {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
}
