import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseArgs, runCli } from "../src/cli.js";
import { updateProject } from "../src/index.js";
import { readCliPackageJson } from "../src/run-init.js";

const spawnSyncMock = vi.hoisted(() => vi.fn(() => ({ status: 0 })));

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return { ...actual, spawnSync: spawnSyncMock };
});

const TMP = join(tmpdir(), "blockml-cli-update-test");

function writePkg(value: unknown): void {
  writeFileSync(join(TMP, "package.json"), JSON.stringify(value, null, 2) + "\n");
}

function readPkg(): Record<string, unknown> {
  return JSON.parse(readFileSync(join(TMP, "package.json"), "utf8")) as Record<string, unknown>;
}

describe("parseArgs update", () => {
  it("maps --no-install and rejects a positional as target", () => {
    const parsed = parseArgs(["update", "--no-install"]);
    expect(parsed.command).toBe("update");
    expect(parsed.noInstall).toBe(true);
    expect(parsed.target).toBeUndefined();

    const extra = parseArgs(["update", "com.acme.bml"]);
    expect(extra.target).toBe("com.acme.bml");
  });
});

describe("blockml update CLI", () => {
  const { version: cliVersion, coreRange } = readCliPackageJson();
  const cliRange = `^${cliVersion}`;

  beforeEach(() => {
    spawnSyncMock.mockReset();
    spawnSyncMock.mockReturnValue({ status: 0 });
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(TMP, { recursive: true });
  });

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it("rewrites registry ranges and installs", async () => {
    writePkg({
      name: "app",
      blockml: { library: "./blocks/com/acme/bml/Library.bml" },
      dependencies: { "@blockml/core": "^1.0.0", lodash: "^4.17.21" },
      devDependencies: { "@blockml/cli": "^0.1.0" },
    });
    writeFileSync(join(TMP, "Library.bml"), "<version>0.1.0</version>\n");
    writeFileSync(join(TMP, "AGENTS.md"), "keep me\n");

    const { code, stderr } = await runCli(["update", "--no-install"], TMP);
    expect(code, stderr).toBe(0);
    const pkg = readPkg() as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    expect(pkg.dependencies["@blockml/core"]).toBe(coreRange);
    expect(pkg.dependencies.lodash).toBe("^4.17.21");
    expect(pkg.devDependencies["@blockml/cli"]).toBe(cliRange);
    expect(stderr).toContain(`Updated devDependencies.@blockml/cli from ^0.1.0 to ${cliRange}`);
    expect(stderr).toMatch(/Next: npm install/);
    expect(spawnSyncMock).not.toHaveBeenCalled();
    expect(readFileSync(join(TMP, "Library.bml"), "utf8")).toBe("<version>0.1.0</version>\n");
    expect(readFileSync(join(TMP, "AGENTS.md"), "utf8")).toBe("keep me\n");
  });

  it("adds missing pins in the init fields", async () => {
    writePkg({
      name: "app",
      blockml: { library: "./blocks/com/acme/bml/Library.bml" },
    });
    const { code, stderr } = await runCli(["update", "--no-install"], TMP);
    expect(code, stderr).toBe(0);
    const pkg = readPkg() as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    expect(pkg.devDependencies["@blockml/cli"]).toBe(cliRange);
    expect(pkg.dependencies["@blockml/core"]).toBe(coreRange);
    expect(stderr).toMatch(/Added devDependencies\.@blockml\/cli/);
    expect(stderr).toMatch(/Added dependencies\.@blockml\/core/);
  });

  it("updates a pin where it already lives", async () => {
    writePkg({
      name: "app",
      blockml: {},
      devDependencies: { "@blockml/core": "^1.0.0", "@blockml/cli": "^0.1.0" },
    });
    const { code, stderr } = await runCli(["update", "--no-install"], TMP);
    expect(code, stderr).toBe(0);
    const pkg = readPkg() as { dependencies?: unknown; devDependencies: Record<string, string> };
    expect(pkg.dependencies).toBeUndefined();
    expect(pkg.devDependencies["@blockml/core"]).toBe(coreRange);
    expect(pkg.devDependencies["@blockml/cli"]).toBe(cliRange);
  });

  it("leaves protocol specifiers and rewrites registry ranges beside them", async () => {
    writePkg({
      name: "app",
      blockml: { library: "./blocks/Library.bml" },
      dependencies: { "@blockml/core": "^1.0.0" },
      devDependencies: { "@blockml/cli": "workspace:*" },
    });
    const beforeAgents = "agents\n";
    writeFileSync(join(TMP, "AGENTS.md"), beforeAgents);
    const { code, stderr } = await runCli(["update", "--no-install"], TMP);
    expect(code, stderr).toBe(0);
    const pkg = readPkg() as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    expect(pkg.devDependencies["@blockml/cli"]).toBe("workspace:*");
    expect(pkg.dependencies["@blockml/core"]).toBe(coreRange);
    expect(stderr).toMatch(/Left devDependencies\.@blockml\/cli at workspace:\*/);
    expect(readFileSync(join(TMP, "AGENTS.md"), "utf8")).toBe(beforeAgents);
  });

  it("leaves file: and npm: specifiers", async () => {
    writePkg({
      name: "app",
      blockml: {},
      dependencies: { "@blockml/core": "file:../core" },
      devDependencies: { "@blockml/cli": "npm:@blockml/cli@0.9.0" },
    });
    const before = readFileSync(join(TMP, "package.json"), "utf8");
    const { code, stderr } = await runCli(["update", "--no-install"], TMP);
    expect(code, stderr).toBe(0);
    expect(readFileSync(join(TMP, "package.json"), "utf8")).toBe(before);
    expect(stderr).toMatch(/Left devDependencies\.@blockml\/cli at npm:@blockml\/cli@0\.9\.0/);
    expect(stderr).toMatch(/Left dependencies\.@blockml\/core at file:\.\.\/core/);
    expect(spawnSyncMock).not.toHaveBeenCalled();
  });

  it("keeps package.json bytes when ranges already match", async () => {
    const text =
      '{ "name": "app", "blockml": {}, "dependencies": { "@blockml/core": "' +
      coreRange +
      '" }, "devDependencies": { "@blockml/cli": "' +
      cliRange +
      '" } }';
    writeFileSync(join(TMP, "package.json"), text);
    const { code, stderr } = await runCli(["update", "--no-install"], TMP);
    expect(code, stderr).toBe(0);
    expect(readFileSync(join(TMP, "package.json"), "utf8")).toBe(text);
    expect(stderr).toMatch(/package\.json already matches this CLI\./);
    expect(stderr).not.toMatch(/Next: npm install/);
  });

  it("runs npm install when ranges already match", async () => {
    writePkg({
      name: "app",
      blockml: {},
      dependencies: { "@blockml/core": coreRange },
      devDependencies: { "@blockml/cli": cliRange },
    });
    const { code, stderr } = await runCli(["update"], TMP);
    expect(code, stderr).toBe(0);
    expect(spawnSyncMock).toHaveBeenCalledWith("npm", ["install"], {
      cwd: TMP,
      stdio: "inherit",
    });
  });

  it("returns 1 when npm install fails after the rewrite", async () => {
    spawnSyncMock.mockReturnValue({ status: 1 });
    writePkg({
      name: "app",
      blockml: {},
      dependencies: { "@blockml/core": "^1.0.0" },
      devDependencies: { "@blockml/cli": "^0.1.0" },
    });
    const { code, stderr } = await runCli(["update"], TMP);
    expect(code).toBe(1);
    expect(stderr).toMatch(/npm install failed/);
    const pkg = readPkg() as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    expect(pkg.dependencies["@blockml/core"]).toBe(coreRange);
    expect(pkg.devDependencies["@blockml/cli"]).toBe(cliRange);
  });

  it("refuses a directory that is not a BlockML project", async () => {
    const missing = await runCli(["update", "--no-install"], TMP);
    expect(missing.code).toBe(2);
    expect(missing.stderr).toMatch(/package\.json is missing/);
    expect(existsSync(join(TMP, "package.json"))).toBe(false);

    writeFileSync(join(TMP, "package.json"), "{ not json");
    const broken = await runCli(["update", "--no-install"], TMP);
    expect(broken.code).toBe(2);
    expect(broken.stderr).toMatch(/Could not parse package\.json/);
    expect(readFileSync(join(TMP, "package.json"), "utf8")).toBe("{ not json");

    writePkg({ name: "plain" });
    const plain = await runCli(["update", "--no-install"], TMP);
    expect(plain.code).toBe(2);
    expect(plain.stderr).toMatch(/no blockml key/);
    expect(readPkg()).toEqual({ name: "plain" });
    expect(spawnSyncMock).not.toHaveBeenCalled();
  });

  it("rejects an unexpected positional and prints usage", async () => {
    writePkg({ name: "app", blockml: {} });
    const before = readFileSync(join(TMP, "package.json"), "utf8");
    const { code, stderr } = await runCli(["update", "com.acme.bml"], TMP);
    expect(code).toBe(2);
    expect(stderr).toMatch(/Unexpected argument: com\.acme\.bml/);
    expect(stderr).toMatch(/blockml update \[--no-install\]/);
    expect(readFileSync(join(TMP, "package.json"), "utf8")).toBe(before);
  });

  it("prints update help", async () => {
    const { code, stderr } = await runCli(["update", "--help"], TMP);
    expect(code).toBe(0);
    expect(stderr).toMatch(/blockml update \[--no-install\]/);
    expect(stderr).toMatch(/npx @blockml\/cli update/);
  });

  it("returns lines without usage from updateProject", () => {
    writePkg({ name: "app", blockml: {} });
    const result = updateProject({ rootDir: TMP, noInstall: true });
    expect(result.code).toBe(0);
    expect(result.lines.map((line) => line.text).join("\n")).not.toMatch(/Usage:/);
  });
});
