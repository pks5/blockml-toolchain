import { describe, expect, it } from "vitest";
import { TypeRegistry } from "@blockml/framework";
import { XsdTarget } from "../src/xsd-target.js";
import type { RenderContext } from "@blockml/compiler";
import { BML_DOCUMENT_NS } from "../src/constants.js";

function mockContext(registry: TypeRegistry, outputBasePath = "schemas"): RenderContext {
  return {
    session: {
      typeRegistry: registry,
      sourceFilePath: "<test>",
      outputBasePath,
      targetName: "xsd",
      scopeKind: "library",
    },
    blockFqn: "",
    outputRelativePath: "",
    child: () => mockContext(registry, outputBasePath),
  };
}

describe("XsdTarget", () => {
  it("emits bml, types, service schemas and root catalog", () => {
    const output = new XsdTarget().render(
      { scope: { kind: "library" } },
      mockContext(new TypeRegistry()),
    );
    expect(output.files).toHaveLength(3);
    expect(output.files.map((f) => f.path)).toEqual([
      "bml.xsd",
      "types.xsd",
      "service.xsd",
    ]);
    expect(output.files[0]?.content).toContain('element name="block"');
    expect(output.rootFiles).toHaveLength(1);
    expect(output.rootFiles![0]?.path).toBe("catalog.xml");
    expect(output.rootFiles![0]?.content).toContain(`name="${BML_DOCUMENT_NS}"`);
    expect(output.rootFiles![0]?.content).toContain('uri="./schemas/bml.xsd"');
  });

  it("omits domain schemas when emitDomainSchemas is false", () => {
    const output = new XsdTarget().render(
      {
        scope: { kind: "library" },
        targetOptions: { emitDomainSchemas: false },
      },
      mockContext(new TypeRegistry(), "custom/schemas"),
    );
    expect(output.files).toHaveLength(1);
    expect(output.files[0]?.path).toBe("bml.xsd");
    expect(output.rootFiles![0]?.content).toContain('uri="./custom/schemas/bml.xsd"');
    expect(output.rootFiles![0]?.content).not.toContain("types.xsd");
    expect(output.rootFiles![0]?.content).not.toContain("service.xsd");
  });
});
