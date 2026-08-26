import { describe, expect, it } from "vitest";
import { resolveBlockReference } from "../src/util/qname.js";

const BINDINGS = {
  vtype: "org.blockml.bml.vscode.type",
  test: "com.blockml.test",
};

describe("resolveBlockReference", () => {
  it("resolves an unqualified tag to the enclosing block (self-reference)", () => {
    const fqn = resolveBlockReference(
      "ConfigurationScope",
      BINDINGS,
      new Map(),
      "org.blockml.bml.vscode.type.ConfigurationScope",
    );
    expect(fqn).toBe("org.blockml.bml.vscode.type.ConfigurationScope");
  });

  it("lets own block name win over a same-spelling Sub-Block", () => {
    const fqn = resolveBlockReference(
      "Host",
      BINDINGS,
      new Map([["Host", "com.blockml.test.Host.Host"]]),
      "com.blockml.test.Host",
    );
    expect(fqn).toBe("com.blockml.test.Host");
  });

  it("still resolves unqualified Sub-Blocks in the enclosing block", () => {
    const fqn = resolveBlockReference(
      "Utils",
      BINDINGS,
      new Map([["Utils", "com.blockml.test.Host.Utils"]]),
      "com.blockml.test.Host",
    );
    expect(fqn).toBe("com.blockml.test.Host.Utils");
  });

  it("still resolves prefixed names via xmlns", () => {
    const fqn = resolveBlockReference(
      "vtype:ConfigurationScope",
      BINDINGS,
      new Map(),
      "org.blockml.bml.vscode.type.ConfigurationScope",
    );
    expect(fqn).toBe("org.blockml.bml.vscode.type.ConfigurationScope");
  });
});
