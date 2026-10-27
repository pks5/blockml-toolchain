import { describe, expect, it, beforeEach, beforeAll } from "vitest";
import { join } from "node:path";
import type { BomDocument } from "@blockml/bom";
import { parse } from "@blockml/parser";
import {
  bootstrapTypeRegistry,
  defaultBootstrapPaths,
  TypeRegistry,
} from "@blockml/framework";
import {
  clearTargets,
  compileBomToOutput,
  compileBmlToBom,
  compileToOutput,
  registerTarget,
  resolveScope,
  scopeAccepts,
  validateRegistryDocuments,
} from "../src/index.js";
import type {
  CompileBomOptions,
  RenderContext,
  RenderOutput,
  RenderTarget,
} from "../src/index.js";

class MockTarget implements RenderTarget {
  readonly name = "mock";
  readonly accepts = ["library", "corpus", "auto"] as const;

  render(_request: unknown, ctx: RenderContext): RenderOutput {
    return {
      files: [
        {
          path: "mock.txt",
          content: `keys:${ctx.session.typeRegistry.size()}`,
        },
      ],
    };
  }
}

class DocumentMockTarget implements RenderTarget {
  readonly name = "doc-mock";
  readonly accepts = ["document"] as const;
  lastSourceFilePath = "";

  render(_request: unknown, ctx: RenderContext): RenderOutput {
    this.lastSourceFilePath = ctx.session.sourceFilePath;
    return {
      files: [
        {
          path: "out.txt",
          content: `keys:${ctx.session.typeRegistry.size()}|src:${ctx.session.sourceFilePath}`,
        },
      ],
    };
  }
}

function minimalBom(filePath = "Host.bml"): BomDocument {
  return {
    kind: "block",
    source: { filePath, format: "xml" },
    block: {
      name: "Host",
      type: "com.test.Host",
      version: "0.1.0",
      members: [],
      subBlocks: [],
      embeddedBlocks: [],
      compositions: [],
    },
  };
}

describe("resolveScope", () => {
  it("resolves auto from libraries", () => {
    const { resolved } = resolveScope(
      { kind: "auto" },
      { libraries: ["lib/Library.bml"] },
    );
    expect(resolved?.kind).toBe("library");
    expect(resolved?.libraries).toEqual(["lib/Library.bml"]);
  });

  it("reports empty auto scope", () => {
    const { resolved, diagnostics } = resolveScope({ kind: "auto" }, {});
    expect(resolved).toBeNull();
    expect(diagnostics.some((d) => d.code === "BML_COMPILE_SCOPE_EMPTY")).toBe(true);
  });
});

describe("scopeAccepts", () => {
  it("accepts library for blockdoc-like target", () => {
    expect(scopeAccepts("library", ["library", "corpus", "auto"])).toBe(true);
  });

  it("rejects document for library-only target", () => {
    expect(scopeAccepts("document", ["library", "corpus", "auto"])).toBe(false);
  });
});

describe("registerTarget", () => {
  beforeEach(() => {
    clearTargets();
  });

  it("throws when name is empty", () => {
    expect(() =>
      registerTarget({
        name: "",
        accepts: ["document"],
        render: () => ({ files: [] }),
      }),
    ).toThrow(/name must be a non-empty string/);
  });

  it("throws when accepts is empty", () => {
    expect(() =>
      registerTarget({
        name: "x",
        accepts: [],
        render: () => ({ files: [] }),
      }),
    ).toThrow(/accepts must be a non-empty array/);
  });

  it("throws when accepts has invalid kind", () => {
    expect(() =>
      registerTarget({
        name: "x",
        accepts: ["nope" as "document"],
        render: () => ({ files: [] }),
      }),
    ).toThrow(/invalid accepts value/);
  });
});

describe("compileToOutput", () => {
  beforeEach(() => {
    clearTargets();
  });

  it("returns BML_UNKNOWN_TARGET when target is missing", () => {
    const result = compileToOutput(
      { scope: { kind: "auto", libraries: ["x/Library.bml"] } },
      "missing",
    );
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === "BML_UNKNOWN_TARGET")).toBe(true);
  });

  it("returns BML_TARGET_SCOPE_MISMATCH for document scope on library target", () => {
    registerTarget(new MockTarget());
    const result = compileToOutput(
      {
        scope: {
          kind: "document",
          document: { source: "<block></block>", filePath: "x.bml" },
        },
      },
      "mock",
    );
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === "BML_TARGET_SCOPE_MISMATCH")).toBe(
      true,
    );
  });
});

describe("compileBomToOutput", () => {
  beforeEach(() => {
    clearTargets();
  });

  it("returns BML_MISSING_TYPE_REGISTRY when typeRegistry is absent", () => {
    registerTarget(new DocumentMockTarget());
    const result = compileBomToOutput(minimalBom(), "doc-mock", {
      typeRegistry: undefined,
    } as unknown as CompileBomOptions);
    expect(result.success).toBe(false);
    expect(result.output).toBeNull();
    expect(
      result.diagnostics.some((d) => d.code === "BML_MISSING_TYPE_REGISTRY"),
    ).toBe(true);
  });

  it("renders with host registry without re-parse", () => {
    const target = new DocumentMockTarget();
    registerTarget(target);
    const registry = new TypeRegistry();
    const doc = minimalBom("pkg/Host.bml");
    registry.register(doc);

    const result = compileBomToOutput(doc, "doc-mock", { typeRegistry: registry });
    expect(result.success).toBe(true);
    expect(result.output?.files[0]?.content).toContain("keys:1");
    expect(result.output?.files[0]?.content).toContain("src:pkg/Host.bml");
    expect(target.lastSourceFilePath).toBe("pkg/Host.bml");
  });

  it("returns BML_TARGET_SCOPE_MISMATCH when target rejects document", () => {
    registerTarget(new MockTarget());
    const registry = new TypeRegistry();
    const result = compileBomToOutput(minimalBom(), "mock", {
      typeRegistry: registry,
    });
    expect(result.success).toBe(false);
    expect(
      result.diagnostics.some((d) => d.code === "BML_TARGET_SCOPE_MISMATCH"),
    ).toBe(true);
  });

  it("returns BML_UNKNOWN_TARGET when target is missing", () => {
    const registry = new TypeRegistry();
    const result = compileBomToOutput(minimalBom(), "missing", {
      typeRegistry: registry,
    });
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === "BML_UNKNOWN_TARGET")).toBe(true);
  });

  it("sets success false when target output.diagnostics contain errors", () => {
    class DiagnosticTarget implements RenderTarget {
      readonly name = "diag-mock";
      readonly accepts = ["document"] as const;

      render(): RenderOutput {
        return {
          files: [{ path: "out.txt", content: "x" }],
          diagnostics: [
            {
              severity: "error",
              code: "BML_TARGET_RENDER",
              message: "render failed",
              source: { file: "out.txt", line: 1, column: 1 },
            },
          ],
        };
      }
    }

    registerTarget(new DiagnosticTarget());
    const registry = new TypeRegistry();
    const doc = minimalBom("pkg/Host.bml");
    registry.register(doc);

    const result = compileBomToOutput(doc, "diag-mock", { typeRegistry: registry });
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === "BML_TARGET_RENDER")).toBe(true);
  });
});

describe("validateRegistryDocuments", () => {
  it("counts unique filePaths and documents with errors", () => {
    const registry = new TypeRegistry();
    const host = minimalBom("pkg/Host.bml");
    host.block.type = "com.test.Host";
    const peer = minimalBom("pkg/Peer.bml");
    peer.block.name = "Peer";
    peer.block.type = "com.test.Peer";
    registry.register(host);
    registry.register(peer);

    const result = validateRegistryDocuments(registry);
    expect(result.blocksTested).toBe(2);
    expect(result.blocksWithErrors).toBeGreaterThanOrEqual(0);
    expect(result.blocksWithErrors).toBeLessThanOrEqual(result.blocksTested);
    expect(Array.isArray(result.diagnostics)).toBe(true);
  });

  it("dedupes multiple FQNs from the same filePath", () => {
    const registry = new TypeRegistry();
    const doc = minimalBom("pkg/Host.bml");
    doc.block.subBlocks = [
      {
        name: "Child",
        type: "com.test.Child",
        version: "0.1.0",
        members: [],
        subBlocks: [],
        embeddedBlocks: [],
        compositions: [],
      },
    ];
    registry.register(doc);

    const result = validateRegistryDocuments(registry);
    expect(result.blocksTested).toBe(1);
  });

  it("filters to the given filePaths; empty array tests nothing", () => {
    const registry = new TypeRegistry();
    const host = minimalBom("pkg/Host.bml");
    host.block.type = "com.test.Host";
    const peer = minimalBom("pkg/Peer.bml");
    peer.block.name = "Peer";
    peer.block.type = "com.test.Peer";
    registry.register(host);
    registry.register(peer);

    const one = validateRegistryDocuments(registry, ["pkg/Host.bml"]);
    expect(one.blocksTested).toBe(1);

    const none = validateRegistryDocuments(registry, []);
    expect(none.blocksTested).toBe(0);
    expect(none.diagnostics).toEqual([]);
  });
});

const BOOL = "org.blockml.bml.type.Boolean";
const TEXT = "org.blockml.bml.type.Text";
const INT = "org.blockml.bml.type.Integer";
const NS = "com.blockml.test.members";

describe("compileBmlToBom instance scalars", () => {
  let registry: TypeRegistry;

  beforeAll(() => {
    const root = join(import.meta.dirname, "..", "..", "..");
    registry = bootstrapTypeRegistry(defaultBootstrapPaths(root), root).registry;
    const brick = [
      `<test:Brick xmlns="http://blockml.org/bml"`,
      ` xmlns:core="org.blockml.bml.core"`,
      ` xmlns:type="org.blockml.bml.type"`,
      ` xmlns:test="${NS}">`,
      `  <baseType>core:Block</baseType>`,
      `  <is>brick</is>`,
      `  <properties>`,
      `    <pillars type="type:Boolean" />`,
      `    <label type="type:Text" />`,
      `    <count type="type:Integer" />`,
      `  </properties>`,
      `</test:Brick>`,
    ].join("\n");
    const parsed = parse(brick, { filePath: "Brick.bml", continueOnError: true });
    expect(parsed.document).not.toBeNull();
    registry.register(parsed.document!);
  });

  it("stores boolean and number attributes as host values and leaves text text", () => {
    const source = [
      `<test:Use xmlns="http://blockml.org/bml"`,
      ` xmlns:core="org.blockml.bml.core"`,
      ` xmlns:test="${NS}">`,
      `  <baseType>core:Block</baseType>`,
      `  <is>use</is>`,
      `  <aggregations>`,
      `    <parts type="test:Brick">`,
      `      <composition>`,
      `        <test:Brick pillars="true" label="true" count="2" />`,
      `      </composition>`,
      `    </parts>`,
      `  </aggregations>`,
      `</test:Use>`,
    ].join("\n");
    const result = compileBmlToBom(
      { source, filePath: "Use.bml" },
      { typeRegistry: registry },
    );
    const errors = result.diagnostics.filter((d) => d.severity === "error");
    expect(errors, errors.map((d) => `${d.code} ${d.message}`).join("\n")).toEqual([]);
    const child = result.output?.block.compositions[0]?.children[0];
    expect(child?.kind).toBe("blockInstance");
    if (child?.kind !== "blockInstance") {
      return;
    }
    expect(child.instance.memberValues.pillars).toMatchObject({
      kind: "literal",
      value: true,
      typeFqn: BOOL,
    });
    expect(child.instance.memberValues.label).toMatchObject({
      kind: "literal",
      value: "true",
      typeFqn: TEXT,
    });
    expect(child.instance.memberValues.count).toMatchObject({
      kind: "literal",
      value: 2,
      typeFqn: INT,
    });
  });
});
