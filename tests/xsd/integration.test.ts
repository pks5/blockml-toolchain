import { join } from "node:path";
import { existsSync } from "node:fs";
import { describe, expect, it, beforeEach } from "vitest";
import { compileToOutput, clearTargets, registerTarget } from "@blockml/compiler";
import { XsdTarget } from "@blockml/xsd-target";
import { bootstrapTypeRegistry } from "@blockml/framework";

const ROOT = join(import.meta.dirname, "..", "..");
const CORE_LIBRARY = join(
  ROOT,
  "node_modules/@blockml/core/blocks/org/blockml/bml/Library.bml",
);

describe("xsd integration", () => {
  beforeEach(() => {
    clearTargets();
    registerTarget(new XsdTarget());
  });

  it("generates bml.xsd from the core library", () => {
    if (!existsSync(CORE_LIBRARY)) {
      throw new Error(`Missing fixture: ${CORE_LIBRARY}`);
    }

    const bootstrap = bootstrapTypeRegistry({
      libraryPaths: [CORE_LIBRARY],
      rootDir: ROOT,
    });

    const result = compileToOutput(
      { scope: { kind: "auto", libraries: [CORE_LIBRARY] } },
      "xsd",
      {
        typeRegistry: bootstrap.registry,
        outputBasePath: "schemas",
        rootDir: ROOT,
      },
      { libraries: [CORE_LIBRARY], rootDir: ROOT },
    );

    expect(result.success, JSON.stringify(result.diagnostics)).toBe(true);
    expect(result.output).not.toBeNull();
    const schema = result.output!.files.find((f) => f.path === "bml.xsd");
    expect(schema).toBeDefined();
    expect(schema!.content).toContain("<xs:schema");
    expect(schema!.content).toContain('element name="block"');
    expect(schema!.content).toContain("processContents=\"lax\"");
  });
});
