import { join } from "node:path";
import { existsSync } from "node:fs";
import { describe, expect, it, beforeEach } from "vitest";
import { compileToOutput, clearTargets, registerTarget } from "@blockml/compiler";
import { BlockDocTarget } from "@blockml/blockdoc-target";
import { bootstrapTypeRegistry } from "@blockml/framework";

const ROOT = join(import.meta.dirname, "..", "..");
const CORE_LIBRARY = join(
  ROOT,
  "node_modules/@blockml/core/blocks/org/blockml/bml/Library.bml",
);

describe("blockdoc integration", () => {
  beforeEach(() => {
    clearTargets();
    registerTarget(new BlockDocTarget());
  });

  it("generates HTML for org.blockml.bml.core.Block from core library", () => {
    if (!existsSync(CORE_LIBRARY)) {
      throw new Error(`Missing fixture: ${CORE_LIBRARY}`);
    }

    const bootstrap = bootstrapTypeRegistry({
      libraryPaths: [CORE_LIBRARY],
      rootDir: ROOT,
    });

    const result = compileToOutput(
      {
        scope: { kind: "auto", libraries: [CORE_LIBRARY] },
        targetOptions: { siteMode: "merged", outLayout: "fqn" },
      },
      "blockdoc",
      {
        typeRegistry: bootstrap.registry,
        outputBasePath: "doc",
        rootDir: ROOT,
      },
      { libraries: [CORE_LIBRARY], rootDir: ROOT },
    );

    expect(result.success, JSON.stringify(result.diagnostics)).toBe(true);
    expect(result.output).not.toBeNull();
    expect(result.output!.files.length).toBeGreaterThan(0);

    const blockPage = result.output!.files.find((f) =>
      f.path.endsWith("org/blockml/bml/core/Block.html"),
    );
    expect(blockPage).toBeDefined();
    expect(blockPage!.content).toContain("org.blockml.bml.core.Block");
    expect(blockPage!.content).toContain("Documentation");

    const valueTypePage = result.output!.files.find((f) =>
      f.path.endsWith("org/blockml/bml/core/ValueType.html"),
    );
    expect(valueTypePage).toBeDefined();
    expect(valueTypePage!.content).toContain('<dt>baseType</dt><dd><a href="');
    expect(valueTypePage!.content).toContain("org.blockml.bml.core.Block");

    const packageIndex = result.output!.files.find(
      (f) => f.path === "org/blockml/bml/core/index.html",
    );
    expect(packageIndex).toBeDefined();
    expect(packageIndex!.content).toContain('<a href="./Block.html">Block</a>');

    const index = result.output!.files.find((f) => f.path === "index.html");
    expect(index).toBeDefined();
    expect(index!.content).toContain('<a href="./org/blockml/bml/core/Block.html">Block</a>');
    expect(index!.content).toMatch(/<h2><a href="\.\/org\/blockml\/bml\/core\/index\.html">core<\/a><\/h2>/);
  });
});
