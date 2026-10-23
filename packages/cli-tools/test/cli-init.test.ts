import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse } from "@blockml/parser";
import { parseArgs, runCli } from "../src/cli.js";
import { initProject } from "../src/index.js";
import { isValidPackageFqn } from "../src/run-init.js";

const TMP = join(import.meta.dirname, ".tmp-cli-init");
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("parseArgs init", () => {
  it("maps package FQN and --install", () => {
    const parsed = parseArgs(["init", "com.acme.bml", "--install", "--src", "blocks"]);
    expect(parsed.command).toBe("init");
    expect(parsed.initFqn).toBe("com.acme.bml");
    expect(parsed.install).toBe(true);
    expect(parsed.srcDir).toBe("blocks");
  });
});

describe("package FQN", () => {
  it("accepts dotted packages and rejects Library", () => {
    expect(isValidPackageFqn("com.acme.bml")).toBe(true);
    expect(isValidPackageFqn("com.acme.bml.app")).toBe(true);
    expect(isValidPackageFqn("com.acme")).toBe(true);
    expect(isValidPackageFqn("com.acme.bml.Library")).toBe(false);
    expect(isValidPackageFqn("Library")).toBe(false);
  });
});

describe("initProject", () => {
  beforeEach(() => {
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(TMP, { recursive: true });
  });

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it("returns code and lines without CLI usage", () => {
    const result = initProject({
      packageFqn: "com.example.bml",
      rootDir: TMP,
    });
    expect(result.code).toBe(0);
    const text = result.lines.map((line) => line.text).join("\n");
    expect(text).toMatch(/Created .*package\.json/);
    expect(text).toMatch(/Created .*Library\.bml/);
    expect(text).toMatch(/Next: npm install && npx blockml validate/);
    expect(text).not.toMatch(/Usage:/);
    expect(result.lines.every((line) => line.kind === "info" || line.kind === "error")).toBe(true);

    const missing = initProject({ packageFqn: "  ", rootDir: TMP });
    expect(missing.code).toBe(2);
    expect(missing.lines.map((line) => line.text).join("\n")).toBe("Specify a package FQN.");
    expect(missing.lines[0]?.kind).toBe("error");
  });
});

describe("blockml init CLI", () => {
  beforeEach(() => {
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(TMP, { recursive: true });
  });

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it("scaffolds an empty directory", async () => {
    const { code, stderr } = await runCli(["init", "com.acme.bml"], TMP);
    expect(code, stderr).toBe(0);
    const pkg = JSON.parse(readFileSync(join(TMP, "package.json"), "utf8"));
    expect(pkg.blockml.library).toBe("./blocks/com/acme/bml/Library.bml");
    expect(pkg.devDependencies["@blockml/cli"]).toMatch(/^\^/);
    expect(pkg.dependencies["@blockml/core"]).toBeTruthy();
    expect(pkg.private).toBe(true);

    const library = readFileSync(join(TMP, "blocks/com/acme/bml/Library.bml"), "utf8");
    expect(library).toMatch(/<acme:Library\b/);
    expect(library).not.toContain("xsi:schemaLocation");
    expect(library).not.toContain("xmlns:xsi");
    expect(library).toMatch(/<version>\s*0\.1\.0\s*<\/version>/);
    expect(library).toMatch(/<acme:README\s*\/>/);
    expect(library).toMatch(/<blockml:Library\s*\/>/);
    expect(library).not.toMatch(/<blocks\b/);

    const readme = readFileSync(join(TMP, "blocks/com/acme/bml/README.bml"), "utf8");
    expect(readme).toMatch(/<acme:README\b/);
    expect(readme).toContain("org.blockml.bml.core");

    expect(readFileSync(join(TMP, "AGENTS.md"), "utf8")).toBe(
      readFileSync(join(REPO_ROOT, "AGENTS.md"), "utf8"),
    );
    expect(readFileSync(join(TMP, "CLAUDE.md"), "utf8")).toBe("@AGENTS.md\n");

    for (const file of [
      join(TMP, "blocks/com/acme/bml/Library.bml"),
      join(TMP, "blocks/com/acme/bml/README.bml"),
    ]) {
      const parsed = parse(readFileSync(file, "utf8"), { filePath: file, continueOnError: true });
      const errors = (parsed.diagnostics ?? []).filter((d) => d.severity === "error");
      expect(errors, `${file} parse errors`).toEqual([]);
    }
  });

  it("merges an existing npm project without overwriting name", async () => {
    writeFileSync(
      join(TMP, "package.json"),
      JSON.stringify(
        {
          name: "existing-app",
          dependencies: { lodash: "^4.17.21" },
        },
        null,
        2,
      ),
    );
    const { code, stderr } = await runCli(["init", "com.acme.bml"], TMP);
    expect(code, stderr).toBe(0);
    const pkg = JSON.parse(readFileSync(join(TMP, "package.json"), "utf8"));
    expect(pkg.name).toBe("existing-app");
    expect(pkg.dependencies.lodash).toBe("^4.17.21");
    expect(pkg.blockml.library).toBe("./blocks/com/acme/bml/Library.bml");
    expect(pkg.dependencies["@blockml/core"]).toBeTruthy();
  });

  it("is idempotent on a second run", async () => {
    await runCli(["init", "com.acme.bml"], TMP);
    const firstLibrary = readFileSync(join(TMP, "blocks/com/acme/bml/Library.bml"), "utf8");
    writeFileSync(join(TMP, "AGENTS.md"), "custom agents\n");
    const { code, stderr } = await runCli(["init", "com.acme.bml"], TMP);
    expect(code, stderr).toBe(0);
    expect(stderr).toMatch(/Skipped existing/);
    expect(readFileSync(join(TMP, "blocks/com/acme/bml/Library.bml"), "utf8")).toBe(firstLibrary);
    expect(readFileSync(join(TMP, "AGENTS.md"), "utf8")).toBe("custom agents\n");
  });

  it("rejects a conflicting blockml.library", async () => {
    writeFileSync(
      join(TMP, "package.json"),
      JSON.stringify({
        name: "conflict",
        blockml: { library: "./other/Library.bml" },
      }),
    );
    const { code, stderr } = await runCli(["init", "com.acme.bml"], TMP);
    expect(code).toBe(2);
    expect(stderr).toMatch(/blockml\.library already points/);
  });

  it("scaffolds a package FQN without a bml segment", async () => {
    const { code, stderr } = await runCli(["init", "com.acme"], TMP);
    expect(code, stderr).toBe(0);
    expect(JSON.parse(readFileSync(join(TMP, "package.json"), "utf8")).blockml.library).toBe(
      "./blocks/com/acme/Library.bml",
    );
    const library = readFileSync(join(TMP, "blocks/com/acme/Library.bml"), "utf8");
    expect(library).toMatch(/<acme:Library\b/);
    expect(library).toContain("com.acme");
  });

  it("rejects a missing or invalid package FQN", async () => {
    const missing = await runCli(["init"], TMP);
    expect(missing.code).toBe(2);
    expect(missing.stderr).toMatch(/Specify a package FQN/);
    expect(missing.stderr).toMatch(/blockml init <package-fqn>/);

    const libraryName = await runCli(["init", "com.acme.bml.Library"], TMP);
    expect(libraryName.code).toBe(2);
    expect(libraryName.stderr).toMatch(/Invalid package FQN/);
  });

  it("keeps the AGENTS.md template identical to the repo root file", () => {
    const root = readFileSync(join(REPO_ROOT, "AGENTS.md"), "utf8");
    const template = readFileSync(
      join(REPO_ROOT, "packages/cli-tools/templates/AGENTS.md"),
      "utf8",
    );
    expect(template).toBe(root);
  });
});
