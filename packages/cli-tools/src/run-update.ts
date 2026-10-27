import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pushLines, type CliOutputLine } from "./cli-style.js";
import { readCliPackageJson } from "./run-init.js";

export interface UpdateProjectOptions {
  rootDir: string;
  /** Skip npm install. Default false, so npm install runs. */
  noInstall?: boolean;
}

export interface UpdateProjectResult {
  code: number;
  lines: CliOutputLine[];
}

const CLI_PACKAGE = "@blockml/cli";
const CORE_PACKAGE = "@blockml/core";
const DEP_FIELDS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

type DepField = (typeof DEP_FIELDS)[number];

interface PinPlan {
  field: DepField;
  from: string | undefined;
  to: string;
  action: "set" | "keep";
  /** Why a keep plan left the specifier alone. */
  keptBecause: "same" | "protocol" | "non-string" | undefined;
}

export function updateProject(options: UpdateProjectOptions): UpdateProjectResult {
  const lines: CliOutputLine[] = [];
  const rootDir = options.rootDir;
  const pkgPath = join(rootDir, "package.json");

  if (!existsSync(pkgPath)) {
    pushLines(lines, "Not a BlockML project. package.json is missing.", "error");
    return { code: 2, lines };
  }

  let raw: string;
  try {
    raw = readFileSync(pkgPath, "utf8");
  } catch {
    pushLines(lines, "Could not parse package.json.", "error");
    return { code: 2, lines };
  }

  let pkg: unknown;
  try {
    pkg = JSON.parse(raw);
  } catch {
    pushLines(lines, "Could not parse package.json.", "error");
    return { code: 2, lines };
  }

  if (!hasBlockmlKey(pkg)) {
    pushLines(lines, "Not a BlockML project. package.json has no blockml key.", "error");
    return { code: 2, lines };
  }

  const record = pkg as Record<string, unknown>;
  for (const field of DEP_FIELDS) {
    if (depRecord(record, field) === "invalid") {
      pushLines(lines, `Could not update package.json ${field}.`, "error");
      return { code: 2, lines };
    }
  }
  const { version: cliVersion, coreRange } = readCliPackageJson();
  const cliRange = `^${cliVersion}`;

  const cliPlan = planPin(record, CLI_PACKAGE, cliRange, "devDependencies");
  if (cliPlan.error) {
    pushLines(lines, cliPlan.error, "error");
    return { code: 2, lines };
  }
  const corePlan = planPin(record, CORE_PACKAGE, coreRange, "dependencies");
  if (corePlan.error) {
    pushLines(lines, corePlan.error, "error");
    return { code: 2, lines };
  }

  const plans = [
    { name: CLI_PACKAGE, items: cliPlan.plans },
    { name: CORE_PACKAGE, items: corePlan.plans },
  ];
  let changed = false;
  for (const pin of plans) {
    for (const item of pin.items) {
      if (item.action === "set") {
        applyPin(record, item, pin.name);
        changed = true;
        pushLines(
          lines,
          item.from === undefined
            ? `Added ${item.field}.${pin.name} ${item.to}`
            : `Updated ${item.field}.${pin.name} from ${item.from} to ${item.to}`,
          "info",
        );
      } else if (item.keptBecause !== "same") {
        const shown = item.from ?? "non-version specifier";
        pushLines(lines, `Left ${item.field}.${pin.name} at ${shown}`, "info");
      }
    }
  }

  if (!changed && plans.every((pin) => pin.items.every((item) => item.keptBecause === "same"))) {
    pushLines(lines, "package.json already matches this CLI.", "info");
  }

  if (changed) {
    try {
      writeFileSync(pkgPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
    } catch {
      pushLines(lines, "Could not write package.json.", "error");
      return { code: 1, lines };
    }
  }

  if (options.noInstall === true) {
    if (changed) {
      pushLines(lines, "Next: npm install", "info");
    }
    return { code: 0, lines };
  }

  const result = spawnSync("npm", ["install"], {
    cwd: rootDir,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    pushLines(lines, "npm install failed.", "error");
    return { code: 1, lines };
  }
  return { code: 0, lines };
}

function hasBlockmlKey(pkg: unknown): boolean {
  return (
    pkg !== null &&
    typeof pkg === "object" &&
    !Array.isArray(pkg) &&
    Object.prototype.hasOwnProperty.call(pkg, "blockml")
  );
}

function depRecord(
  pkg: Record<string, unknown>,
  field: DepField,
): Record<string, unknown> | "missing" | "invalid" {
  if (!Object.prototype.hasOwnProperty.call(pkg, field) || pkg[field] === undefined) {
    return "missing";
  }
  const value = pkg[field];
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return "invalid";
  }
  return value as Record<string, unknown>;
}

/** Registry ranges have no ":". workspace:, file:, npm:, git, and http specifiers do. */
function isRegistryRange(range: string): boolean {
  return !range.includes(":");
}

function planPin(
  pkg: Record<string, unknown>,
  name: string,
  target: string,
  defaultField: DepField,
): { plans: PinPlan[]; error?: string } {
  const hits: { field: DepField; value: unknown }[] = [];
  for (const field of DEP_FIELDS) {
    const rec = depRecord(pkg, field);
    if (rec === "missing") {
      continue;
    }
    if (rec === "invalid") {
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(rec, name)) {
      hits.push({ field, value: rec[name] });
    }
  }

  if (hits.length === 0) {
    const dest = depRecord(pkg, defaultField);
    if (dest === "invalid") {
      return { plans: [], error: `Could not update package.json ${defaultField}.` };
    }
    return {
      plans: [
        {
          field: defaultField,
          from: undefined,
          to: target,
          action: "set",
          keptBecause: undefined,
        },
      ],
    };
  }

  const plans: PinPlan[] = [];
  for (const hit of hits) {
    if (typeof hit.value !== "string") {
      plans.push({
        field: hit.field,
        from: undefined,
        to: target,
        action: "keep",
        keptBecause: "non-string",
      });
      continue;
    }
    if (!isRegistryRange(hit.value)) {
      plans.push({
        field: hit.field,
        from: hit.value,
        to: target,
        action: "keep",
        keptBecause: "protocol",
      });
      continue;
    }
    if (hit.value === target) {
      plans.push({
        field: hit.field,
        from: hit.value,
        to: target,
        action: "keep",
        keptBecause: "same",
      });
      continue;
    }
    plans.push({
      field: hit.field,
      from: hit.value,
      to: target,
      action: "set",
      keptBecause: undefined,
    });
  }
  return { plans };
}

function applyPin(pkg: Record<string, unknown>, plan: PinPlan, name: string): void {
  const rec = depRecord(pkg, plan.field);
  if (rec === "missing") {
    pkg[plan.field] = { [name]: plan.to };
    return;
  }
  if (rec === "invalid") {
    return;
  }
  rec[name] = plan.to;
}
