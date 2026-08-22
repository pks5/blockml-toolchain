import { describe, expect, it, beforeEach } from "vitest";
import type { BomDocument } from "@blockml/bom";
import { TypeRegistry } from "@blockml/framework";
import {
  clearTargets,
  compileBomToOutput,
  compileToOutput,
  registerTarget,
  resolveScope,
  scopeAccepts,
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
});
