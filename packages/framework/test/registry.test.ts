import { describe, expect, it, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  bootstrapTypeRegistry,
  defaultBootstrapPaths,
  resolveLibrarySeeds,
  TypeRegistry,
} from "../src/index.js";

const ROOT = join(import.meta.dirname, "..", "..", "..");
const TMP = join(import.meta.dirname, ".tmp-discover");

describe("TypeRegistry bootstrap", () => {
  it("loads framework and domain blocks from default paths", () => {
    const { registry, diagnostics } = bootstrapTypeRegistry(defaultBootstrapPaths(ROOT), ROOT);
    const bootstrapErrors = diagnostics.filter(
      (d) =>
        d.severity === "error" &&
        d.code !== "BML_MAP_ERROR" &&
        d.code !== "BML_UNKNOWN_NAMESPACE_PREFIX" &&
        d.code !== "BML_UNQUALIFIED_BLOCK_REFERENCE" &&
        d.code !== "BML_INVALID_TYPE_REFERENCE" &&
        d.code !== "BML_UNKNOWN_ELEMENT" &&
        d.code !== "BML_UNKNOWN_ATTRIBUTE" &&
        d.code !== "BML_UNKNOWN_DIRECTIVE" &&
        d.code !== "BML_STANDALONE_COMPOSITION" &&
        d.code !== "BML_DUPLICATE_COMPOSITION" &&
        d.code !== "BML_UNEXPECTED_TEXT",
    );
    expect(bootstrapErrors).toEqual([]);

    expect(registry.has("org.blockml.bml.core.Block")).toBe(true);
    expect(registry.has("com.machineblocks.bml.core.NativeBlock")).toBe(true);
    expect(registry.has("com.machineblocks.bml.type.SizeXYZ")).toBe(true);
    expect(registry.has("com.machineblocks.bml.type.BaseCutout")).toBe(true);
    expect(registry.size()).toBeGreaterThan(50);
  });

  it("registers sub-blocks and retrieves by FQN", () => {
    const registry = new TypeRegistry();
    const { registry: boot } = bootstrapTypeRegistry(defaultBootstrapPaths(ROOT), ROOT);
    const blockDoc = boot.get("org.blockml.bml.core.Block");
    expect(blockDoc).toBeDefined();
    if (blockDoc) {
      registry.register(blockDoc);
      expect(registry.get("org.blockml.bml.core.Block")?.block.name).toBe("Block");
    }
  });

  it("loads core library via libraryPaths", () => {
    const libraryPath = join(
      ROOT,
      "node_modules/@blockml/core/blocks/org/blockml/bml/Library.bml",
    );
    const { registry, diagnostics } = bootstrapTypeRegistry({
      libraryPaths: [libraryPath],
      rootDir: ROOT,
    });
    const errors = diagnostics.filter(
      (d) =>
        d.severity === "error" &&
        d.code !== "BML_MAP_ERROR" &&
        d.code !== "BML_UNKNOWN_NAMESPACE_PREFIX" &&
        d.code !== "BML_UNQUALIFIED_BLOCK_REFERENCE" &&
        d.code !== "BML_INVALID_TYPE_REFERENCE" &&
        d.code !== "BML_UNKNOWN_ELEMENT" &&
        d.code !== "BML_UNKNOWN_ATTRIBUTE" &&
        d.code !== "BML_UNKNOWN_DIRECTIVE" &&
        d.code !== "BML_STANDALONE_COMPOSITION" &&
        d.code !== "BML_DUPLICATE_COMPOSITION" &&
        d.code !== "BML_UNEXPECTED_TEXT",
    );
    expect(errors, JSON.stringify(errors)).toEqual([]);
    expect(registry.has("org.blockml.bml.core.Block")).toBe(true);
    expect(registry.size()).toBeGreaterThan(50);
  });

  it("reports BML_LIBRARY_RESOLVE_ERROR for missing library path", () => {
    const { diagnostics } = bootstrapTypeRegistry({
      libraryPaths: [join(ROOT, "missing/Library.bml")],
      rootDir: ROOT,
    });
    expect(
      diagnostics.some((d) => d.code === "BML_LIBRARY_RESOLVE_ERROR"),
    ).toBe(true);
  });

  it("discovers BlockML npm and workspace packages", () => {
    const paths = defaultBootstrapPaths(ROOT).map((p) => p.replaceAll("\\", "/"));
    expect(paths.some((p) => p.endsWith("node_modules/@blockml/core/blocks"))).toBe(
      true,
    );
    expect(
      paths.some((p) => p.includes("@machineblocks/core") && p.endsWith("/blocks")),
    ).toBe(true);
    expect(paths.some((p) => p.includes("/packages/parser/"))).toBe(false);
  });

  it("discovers packages from a nested cwd via node_modules walk-up", () => {
    const paths = defaultBootstrapPaths(join(ROOT, "packages/bom")).map((p) =>
      p.replaceAll("\\", "/"),
    );
    expect(paths.some((p) => p.endsWith("node_modules/@blockml/core/blocks"))).toBe(
      true,
    );
  });

  it("still has core types when the library tree is covered by corpus paths", () => {
    const libraryPath = join(
      ROOT,
      "node_modules/@blockml/core/blocks/org/blockml/bml/Library.bml",
    );
    const coreBlocks = join(ROOT, "node_modules/@blockml/core/blocks");
    const { registry } = bootstrapTypeRegistry({
      libraryPaths: [libraryPath],
      paths: [coreBlocks],
      rootDir: ROOT,
    });
    expect(registry.has("org.blockml.bml.core.Block")).toBe(true);
  });

  it("loads core from the FQN graph when a seed Library.bml reuses the core Library type", () => {
    const bomRoot = join(ROOT, "packages/bom");
    const { registry } = bootstrapTypeRegistry({
      libraryPaths: [join(bomRoot, "blocks/org/blockml/bml/bom/Library.bml")],
      paths: [join(bomRoot, "blocks")],
      rootDir: bomRoot,
    });
    expect(registry.has("org.blockml.bml.core.Block")).toBe(true);
    expect(registry.has("org.blockml.bml.definition.MemberDefinition")).toBe(true);
    expect(registry.has("org.blockml.bml.bom.member.MemberDefinition")).toBe(true);
  });
});

describe("defaultBootstrapPaths discovery fixtures", () => {
  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it("indexes a node_modules package with blockml.library", () => {
    const pkg = join(TMP, "node_modules/@acme/types");
    mkdirSync(join(pkg, "blocks/acme"), { recursive: true });
    writeFileSync(
      join(TMP, "package.json"),
      JSON.stringify({
        name: "tmp-discover",
        dependencies: { "@acme/types": "1.0.0" },
      }),
      "utf8",
    );
    writeFileSync(
      join(pkg, "package.json"),
      JSON.stringify({
        name: "@acme/types",
        blockml: { library: "./blocks/acme/Library.bml" },
      }),
      "utf8",
    );
    const paths = defaultBootstrapPaths(TMP).map((p) => p.replaceAll("\\", "/"));
    expect(paths.some((p) => p.endsWith("node_modules/@acme/types/blocks"))).toBe(true);
  });

  it("indexes a node_modules package with blockml.config.json", () => {
    const pkg = join(TMP, "node_modules/plain-bml");
    mkdirSync(join(pkg, "blocks"), { recursive: true });
    writeFileSync(
      join(TMP, "package.json"),
      JSON.stringify({
        name: "tmp-discover",
        dependencies: { "plain-bml": "1.0.0" },
      }),
      "utf8",
    );
    writeFileSync(join(pkg, "package.json"), JSON.stringify({ name: "plain-bml" }), "utf8");
    writeFileSync(
      join(pkg, "blockml.config.json"),
      JSON.stringify({ srcDir: "blocks" }),
      "utf8",
    );
    const paths = defaultBootstrapPaths(TMP).map((p) => p.replaceAll("\\", "/"));
    expect(paths.some((p) => p.endsWith("node_modules/plain-bml/blocks"))).toBe(true);
  });

  it("indexes a blockml.library package that is not a production dependency", () => {
    const pkg = join(TMP, "node_modules/@acme/types");
    mkdirSync(join(pkg, "blocks/acme"), { recursive: true });
    mkdirSync(join(TMP, "blocks"), { recursive: true });
    writeFileSync(join(TMP, "package.json"), JSON.stringify({ name: "tmp-index" }), "utf8");
    writeFileSync(
      join(pkg, "package.json"),
      JSON.stringify({
        name: "@acme/types",
        blockml: { library: "./blocks/acme/Library.bml" },
      }),
      "utf8",
    );
    writeFileSync(
      join(pkg, "blocks/acme/Library.bml"),
      `<block xmlns="http://blockml.org/bml" xmlns:core="org.blockml.bml.core" xmlns:acme="acme.types">
  <name>Library</name>
  <type>acme:Library</type>
  <baseType>core:BlockLibrary</baseType>
</block>
`,
      "utf8",
    );
    writeFileSync(
      join(pkg, "blocks/acme/Widget.bml"),
      `<block xmlns="http://blockml.org/bml" xmlns:core="org.blockml.bml.core" xmlns:acme="acme.types">
  <name>Widget</name>
  <type>acme:Widget</type>
  <baseType>core:Block</baseType>
</block>
`,
      "utf8",
    );
    writeFileSync(
      join(TMP, "blocks/Library.bml"),
      `<block xmlns="http://blockml.org/bml" xmlns:core="org.blockml.bml.core" xmlns:acme="acme.types">
  <name>Library</name>
  <type>acme:AppLibrary</type>
  <baseType>core:BlockLibrary</baseType>
  <aggregations>
    <dependencies>
      <composition>
        <acme:Library />
      </composition>
    </dependencies>
  </aggregations>
</block>
`,
      "utf8",
    );
    expect(defaultBootstrapPaths(TMP)).toEqual([]);
    const { registry } = bootstrapTypeRegistry({
      libraryPaths: [join(TMP, "blocks/Library.bml")],
      paths: [join(TMP, "blocks")],
      rootDir: TMP,
    });
    expect(registry.has("acme.types.Widget")).toBe(true);
  });

  it("indexes blockml.library at default srcDir even when the library path has no /blocks/", () => {
    const pkg = join(TMP, "node_modules/@acme/catalog");
    mkdirSync(join(pkg, "blocks"), { recursive: true });
    mkdirSync(join(pkg, "catalog"), { recursive: true });
    writeFileSync(
      join(TMP, "package.json"),
      JSON.stringify({
        name: "tmp-discover",
        dependencies: { "@acme/catalog": "1.0.0" },
      }),
      "utf8",
    );
    writeFileSync(
      join(pkg, "package.json"),
      JSON.stringify({
        name: "@acme/catalog",
        blockml: { library: "./catalog/Library.bml" },
      }),
      "utf8",
    );
    const paths = defaultBootstrapPaths(TMP).map((p) => p.replaceAll("\\", "/"));
    expect(paths.some((p) => p.endsWith("node_modules/@acme/catalog/blocks"))).toBe(
      true,
    );
  });

  it("uses foreign blockml.config.json srcDir over the default", () => {
    const pkg = join(TMP, "node_modules/@acme/alt");
    mkdirSync(join(pkg, "src"), { recursive: true });
    writeFileSync(
      join(TMP, "package.json"),
      JSON.stringify({
        name: "tmp-discover",
        dependencies: { "@acme/alt": "1.0.0" },
      }),
      "utf8",
    );
    writeFileSync(
      join(pkg, "package.json"),
      JSON.stringify({
        name: "@acme/alt",
        blockml: { library: "./src/Library.bml" },
      }),
      "utf8",
    );
    writeFileSync(
      join(pkg, "blockml.config.json"),
      JSON.stringify({ srcDir: "src" }),
      "utf8",
    );
    const paths = defaultBootstrapPaths(TMP).map((p) => p.replaceAll("\\", "/"));
    expect(paths.some((p) => p.endsWith("node_modules/@acme/alt/src"))).toBe(true);
  });
});

describe("resolveLibrarySeeds", () => {
  it("prepends package identity and dedupes symlink extras", () => {
    const bomRoot = join(ROOT, "packages/bom");
    const identity = join(bomRoot, "blocks/org/blockml/bml/bom/Library.bml");
    const viaNm = join(
      ROOT,
      "node_modules/@blockml/bom/blocks/org/blockml/bml/bom/Library.bml",
    );
    const seeds = resolveLibrarySeeds(bomRoot, [viaNm]);
    expect(seeds).toHaveLength(1);
    expect(seeds[0]!.replaceAll("\\", "/")).toBe(identity.replaceAll("\\", "/"));
  });
});
