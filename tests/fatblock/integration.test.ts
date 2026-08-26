import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { clearTargets, compileToOutput, registerTarget } from "@blockml/compiler";
import { bootstrapTypeRegistry } from "@blockml/framework";
import { FatBlockTarget } from "@blockml/fatblock-target";

const ROOT = join(import.meta.dirname, "..", "..");
const CORE_LIBRARY = join(
  ROOT,
  "node_modules/@blockml/core/blocks/org/blockml/bml/Library.bml",
);

const HOST_BML = `<block xmlns="http://blockml.org/bml"
  xmlns:core="org.blockml.bml.core"
  xmlns:fat="com.test.fatblock">
  <name>Host</name>
  <type>fat:Host</type>
  <baseType>core:Block</baseType>
  <is>Host block</is>
  <version>1.0.0</version>
</block>`;

const PEER_BML = `<block xmlns="http://blockml.org/bml"
  xmlns:core="org.blockml.bml.core"
  xmlns:fat="com.test.fatblock">
  <name>Peer</name>
  <type>fat:Peer</type>
  <baseType>core:Block</baseType>
  <is>Peer block</is>
  <version>1.0.0</version>
  <subBlocks>
    <block>
      <name>Part</name>
      <baseType>core:Block</baseType>
      <is>sub part</is>
      <version>1.0.0</version>
    </block>
  </subBlocks>
</block>`;

describe("fatblock integration", () => {
  const tmpRoot = join(import.meta.dirname, ".tmp-fatblock");
  const srcDir = join(tmpRoot, "src");

  beforeEach(() => {
    if (!existsSync(CORE_LIBRARY)) {
      throw new Error(`Missing fixture: ${CORE_LIBRARY}`);
    }
    clearTargets();
    registerTarget(new FatBlockTarget());
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "Host.bml"), HOST_BML, "utf8");
    writeFileSync(join(srcDir, "Peer.bml"), PEER_BML, "utf8");
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
    clearTargets();
  });

  it("produces fat block via compileToOutput", () => {
    const bootstrap = bootstrapTypeRegistry({
      libraryPaths: [CORE_LIBRARY],
      paths: [srcDir],
      rootDir: ROOT,
    });
    const hostPath = join(srcDir, "Host.bml");

    const result = compileToOutput(
      {
        scope: { kind: "document", document: { source: HOST_BML, filePath: hostPath } },
        targetOptions: { srcDir, rootDir: ROOT },
      },
      "fatblock",
      { typeRegistry: bootstrap.registry, rootDir: ROOT },
    );

    expect(result.success, JSON.stringify(result.diagnostics)).toBe(true);
    const output = result.output as { files: { path: string; content: string }[] };
    expect(output.files[0]?.path).toBe("com.test.fatblock.Host.fat.bml");
    expect(output.files[0]?.content).toContain("<embeddedBlocks>");
    expect(output.files[0]?.content).toContain("fat:Peer");
    expect(output.files[0]?.content).toContain("<subBlocks>");
  });
});
