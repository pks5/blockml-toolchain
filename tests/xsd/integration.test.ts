import { join } from "node:path";
import { existsSync } from "node:fs";
import { describe, expect, it, beforeEach } from "vitest";
import { compileToOutput, clearTargets, registerTarget } from "@blockml/compiler";
import { XsdTarget, BML_DOCUMENT_NS } from "@blockml/xsd-target";
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

  it("generates bml, types, service schemas and catalog from the core library", () => {
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

    const bml = result.output!.files.find((f) => f.path === "bml.xsd");
    expect(bml).toBeDefined();
    expect(bml!.content).toContain("<xs:schema");
    expect(bml!.content).toContain('element name="block"');
    expect(bml!.content).not.toContain("<xs:any ");

    const types = result.output!.files.find((f) => f.path === "types.xsd");
    expect(types).toBeDefined();
    expect(types!.content).toContain('<xs:element name="Boolean"');

    const service = result.output!.files.find((f) => f.path === "service.xsd");
    expect(service).toBeDefined();
    expect(service!.content).toContain('<xs:element name="Math"');

    const catalog = (result.output as { rootFiles?: { path: string; content: string }[] })
      .rootFiles?.find((f) => f.path === "catalog.xml");
    expect(catalog).toBeDefined();
    expect(catalog!.content).toContain(`name="${BML_DOCUMENT_NS}"`);
    expect(catalog!.content).toContain('uri="./schemas/bml.xsd"');
  });
});
