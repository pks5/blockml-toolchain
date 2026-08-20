import { describe, expect, it, beforeEach } from "vitest";
import { TypeRegistry } from "@blockml/framework";
import { XsdTarget } from "../src/xsd-target.js";
import type { RenderContext } from "@blockml/compiler";

function mockContext(registry: TypeRegistry): RenderContext {
  return {
    session: {
      typeRegistry: registry,
      sourceFilePath: "<test>",
      outputBasePath: "schemas",
      targetName: "xsd",
      documentKind: "block",
      isPresetBlock: false,
      scopeKind: "library",
    },
    blockFqn: "",
    outputRelativePath: "",
    child: () => mockContext(registry),
  };
}

describe("XsdTarget", () => {
  beforeEach(() => {
    // no registry side effects
  });

  it("emits bml.xsd", () => {
    const output = new XsdTarget().render(
      { scope: { kind: "library" } },
      mockContext(new TypeRegistry()),
    );
    expect(output.files).toHaveLength(1);
    expect(output.files[0]?.path).toBe("bml.xsd");
    expect(output.files[0]?.content).toContain('element name="block"');
  });
});
