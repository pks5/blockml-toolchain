import { describe, expect, it, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "@blockml/parser";
import { bootstrapTypeRegistry, TypeRegistry } from "../../src/index.js";
import { isNodeModulesPath } from "../../src/registry/package-paths.js";

const TMP = join(import.meta.dirname, ".tmp-source-priority");

function widgetBml(is: string): string {
  return `<block xmlns="http://blockml.org/bml" xmlns:core="org.blockml.bml.core" xmlns:t="com.example.prio">
  <name>Widget</name>
  <type>t:Widget</type>
  <baseType>core:Block</baseType>
  <is>${is}</is>
</block>
`;
}

function libraryBml(prefix: string, pkg: string, typeName: string, extras = ""): string {
  return `<block xmlns="http://blockml.org/bml" xmlns:core="org.blockml.bml.core" xmlns:${prefix}="${pkg}">
  <name>Library</name>
  <type>${prefix}:${typeName}</type>
  <baseType>core:BlockLibrary</baseType>
  ${extras}
</block>
`;
}

function parseAt(text: string, filePath: string) {
  const parsed = parse(text, { filePath, continueOnError: true });
  expect(parsed.document).not.toBeNull();
  return parsed.document!;
}

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe("isNodeModulesPath", () => {
  it("detects node_modules segments on any platform", () => {
    expect(isNodeModulesPath("/proj/blocks/Foo.bml")).toBe(false);
    expect(isNodeModulesPath("/proj/node_modules/@acme/core/blocks/Foo.bml")).toBe(true);
    expect(isNodeModulesPath("C:\\proj\\node_modules\\@acme\\Foo.bml")).toBe(true);
    expect(isNodeModulesPath(undefined)).toBe(false);
  });
});

describe("TypeRegistry source priority", () => {
  it("does not replace a workspace entry with a node_modules copy", () => {
    const registry = new TypeRegistry();
    registry.register(parseAt(widgetBml("local"), "/proj/blocks/Widget.bml"));
    registry.register(
      parseAt(widgetBml("npm"), "/proj/node_modules/@acme/core/blocks/Widget.bml"),
    );
    expect(registry.get("com.example.prio.Widget")?.block.is).toBe("local");
  });

  it("replaces a node_modules entry with a workspace copy", () => {
    const registry = new TypeRegistry();
    registry.register(
      parseAt(widgetBml("npm"), "/proj/node_modules/@acme/core/blocks/Widget.bml"),
    );
    registry.register(parseAt(widgetBml("local"), "/proj/blocks/Widget.bml"));
    expect(registry.get("com.example.prio.Widget")?.block.is).toBe("local");
  });

  it("last-write wins among workspace sources", () => {
    const registry = new TypeRegistry();
    registry.register(parseAt(widgetBml("first"), "/proj/blocks/Widget.bml"));
    registry.register(parseAt(widgetBml("second"), "/proj/packages/acme/blocks/Widget.bml"));
    expect(registry.get("com.example.prio.Widget")?.block.is).toBe("second");
  });

  it("withOverlay registers the open document on a copy", () => {
    const registry = new TypeRegistry();
    registry.register(parseAt(widgetBml("disk"), "/proj/blocks/Widget.bml"));
    const overlay = registry.withOverlay(parseAt(widgetBml("buffer"), "/proj/blocks/Widget.bml"));
    expect(overlay.get("com.example.prio.Widget")?.block.is).toBe("buffer");
    expect(registry.get("com.example.prio.Widget")?.block.is).toBe("disk");
  });
});

describe("bootstrap source priority", () => {
  it("keeps project sources when a later corpus path is node_modules", () => {
    const localBlocks = join(TMP, "blocks");
    const npmBlocks = join(TMP, "node_modules/@acme/core/blocks");
    mkdirSync(localBlocks, { recursive: true });
    mkdirSync(npmBlocks, { recursive: true });
    writeFileSync(join(localBlocks, "Widget.bml"), widgetBml("local"));
    writeFileSync(join(npmBlocks, "Widget.bml"), widgetBml("npm"));

    const { registry } = bootstrapTypeRegistry({
      paths: [localBlocks, npmBlocks],
      rootDir: TMP,
    });
    expect(registry.get("com.example.prio.Widget")?.block.is).toBe("local");
    expect(registry.get("com.example.prio.Widget")?.source.filePath.replaceAll("\\", "/")).toContain(
      "/blocks/Widget.bml",
    );
  });

  it("resolves a duplicate Library FQN to the workspace package, not npm", () => {
    const appLib = join(TMP, "blocks/Library.bml");
    const wsPkg = join(TMP, "packages/acme");
    const npmPkg = join(TMP, "node_modules/@acme/lib");
    mkdirSync(join(TMP, "blocks"), { recursive: true });
    mkdirSync(join(wsPkg, "blocks/acme"), { recursive: true });
    mkdirSync(join(npmPkg, "blocks/acme"), { recursive: true });

    writeFileSync(
      join(TMP, "package.json"),
      JSON.stringify({
        name: "app",
        blockml: { library: "./blocks/Library.bml" },
      }),
    );
    writeFileSync(
      join(wsPkg, "package.json"),
      JSON.stringify({
        name: "@acme/lib",
        blockml: { library: "./blocks/acme/Library.bml" },
      }),
    );
    writeFileSync(
      join(npmPkg, "package.json"),
      JSON.stringify({
        name: "@acme/lib",
        blockml: { library: "./blocks/acme/Library.bml" },
      }),
    );

    writeFileSync(
      appLib,
      `<block xmlns="http://blockml.org/bml" xmlns:core="org.blockml.bml.core" xmlns:app="app.types" xmlns:acme="acme.types">
  <name>Library</name>
  <type>app:Library</type>
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
    );
    writeFileSync(join(wsPkg, "blocks/acme/Library.bml"), libraryBml("acme", "acme.types", "Library"));
    writeFileSync(
      join(wsPkg, "blocks/acme/LocalOnly.bml"),
      `<block xmlns="http://blockml.org/bml" xmlns:core="org.blockml.bml.core" xmlns:acme="acme.types">
  <name>LocalOnly</name>
  <type>acme:LocalOnly</type>
  <baseType>core:Block</baseType>
  <is>workspace</is>
</block>
`,
    );
    writeFileSync(join(npmPkg, "blocks/acme/Library.bml"), libraryBml("acme", "acme.types", "Library"));
    writeFileSync(
      join(npmPkg, "blocks/acme/NpmOnly.bml"),
      `<block xmlns="http://blockml.org/bml" xmlns:core="org.blockml.bml.core" xmlns:acme="acme.types">
  <name>NpmOnly</name>
  <type>acme:NpmOnly</type>
  <baseType>core:Block</baseType>
  <is>npm</is>
</block>
`,
    );

    const { registry } = bootstrapTypeRegistry({
      libraryPaths: [appLib],
      paths: [join(TMP, "blocks")],
      rootDir: TMP,
    });
    expect(registry.has("acme.types.LocalOnly")).toBe(true);
    expect(registry.has("acme.types.NpmOnly")).toBe(false);
  });
});
