import { describe, expect, it, beforeEach } from "vitest";
import {
  clearTargets,
  compileToOutput,
  registerTarget,
  resolveScope,
  scopeAccepts,
} from "../src/index.js";
import type { RenderContext, RenderOutput, RenderTarget } from "../src/index.js";

class MockTarget implements RenderTarget {
  readonly name = "mock";
  readonly accepts = ["library", "corpus", "auto"];

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
