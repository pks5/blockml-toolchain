import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { inspectProject, isLeafTypeFqn } from "../src/index.js";

const TMP = join(import.meta.dirname, ".tmp-inspect");
const NS = "com.blockml.test.inspect";

function blockXml(opts: {
  name: string;
  extra?: string;
  baseType?: string;
}): string {
  const extra = opts.extra ?? "  <documentation>inspect fixture</documentation>";
  const base = opts.baseType ?? "core:Block";
  return [
    '<block xmlns="http://blockml.org/bml"',
    ' xmlns:core="org.blockml.bml.core"',
    ' xmlns:type="org.blockml.bml.type"',
    ` xmlns:test="${NS}">`,
    `  <name>${opts.name}</name>`,
    `  <type>test:${opts.name}</type>`,
    `  <baseType>${base}</baseType>`,
    "  <is>inspect fixture</is>",
    extra,
    "</block>",
    "",
  ].join("\n");
}

function writeProject(dir: string, files: Record<string, string>): void {
  mkdirSync(join(dir, "blocks"), { recursive: true });
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "inspect-fixture", private: true }, null, 2),
  );
  for (const [rel, contents] of Object.entries(files)) {
    const path = join(dir, rel);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, contents);
  }
}

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe("isLeafTypeFqn", () => {
  it("treats the type package and ValueType as leaves", () => {
    expect(isLeafTypeFqn("org.blockml.bml.type.Integer")).toBe(true);
    expect(isLeafTypeFqn("org.blockml.bml.core.ValueType")).toBe(true);
    expect(isLeafTypeFqn(`${NS}.Address`)).toBe(false);
  });
});

describe("inspectProject", () => {
  it("projects depth 0 as root only and depth 1 with declared member types", () => {
    const dir = join(TMP, "depth");
    writeProject(dir, {
      "blocks/Address.bml": blockXml({ name: "Address" }),
      "blocks/Customer.bml": blockXml({
        name: "Customer",
        extra: [
          "  <documentation>a customer</documentation>",
          "  <properties>",
          '    <address type="test:Address"/>',
          "  </properties>",
        ].join("\n"),
      }),
    });
    const d0 = inspectProject(`${NS}.Customer`, { rootDir: dir, depth: 0 });
    expect(d0.depth).toBe(0);
    expect(d0.root).toBe(`${NS}.Customer`);
    expect(Object.keys(d0.blocks)).toEqual([`${NS}.Customer`]);
    const addressMember = d0.blocks[`${NS}.Customer`]?.members.find((m) => m.name === "address");
    expect(addressMember?.type?.ref).toBe(`${NS}.Address`);

    const d1 = inspectProject(`${NS}.Customer`, { rootDir: dir, depth: 1 });
    expect(d1.blocks[`${NS}.Address`]).toBeDefined();
    expect(d1.blocks[`${NS}.Address`]?.name).toBe("Address");
    expect(d1.unresolved).toEqual([]);
  });

  it("sets inheritedFrom for members declared on the base type", () => {
    const dir = join(TMP, "inherit");
    writeProject(dir, {
      "blocks/Parent.bml": blockXml({
        name: "Parent",
        extra: [
          "  <documentation>parent</documentation>",
          "  <properties>",
          '    <label type="type:Text"/>',
          "  </properties>",
        ].join("\n"),
      }),
      "blocks/Child.bml": blockXml({
        name: "Child",
        baseType: "test:Parent",
        extra: "  <documentation>child</documentation>",
      }),
    });
    const result = inspectProject(`${NS}.Child`, { rootDir: dir, depth: 0 });
    const label = result.blocks[`${NS}.Child`]?.members.find((m) => m.name === "label");
    expect(label?.inheritedFrom).toBe(`${NS}.Parent`);
    expect(result.blocks[`${NS}.Parent`]).toBeUndefined();
    expect(result.blocks[`${NS}.Child`]?.ancestors).toContain(`${NS}.Parent`);
  });

  it("does not expand Integer into blocks", () => {
    const dir = join(TMP, "leaf");
    writeProject(dir, {
      "blocks/Counted.bml": blockXml({
        name: "Counted",
        extra: [
          "  <documentation>counted</documentation>",
          "  <properties>",
          '    <n type="type:Integer"/>',
          "  </properties>",
        ].join("\n"),
      }),
    });
    const result = inspectProject(`${NS}.Counted`, { rootDir: dir, depth: 1 });
    expect(result.blocks[`${NS}.Counted`]).toBeDefined();
    expect(result.blocks["org.blockml.bml.type.Integer"]).toBeUndefined();
    const n = result.blocks[`${NS}.Counted`]?.members.find((m) => m.name === "n");
    expect(n?.type?.ref).toBe("org.blockml.bml.type.Integer");
  });

  it("records unresolved member types", () => {
    const dir = join(TMP, "missing");
    writeProject(dir, {
      "blocks/Broken.bml": blockXml({
        name: "Broken",
        extra: [
          "  <documentation>broken</documentation>",
          "  <properties>",
          '    <ghost type="test:MissingType"/>',
          "  </properties>",
        ].join("\n"),
      }),
    });
    const result = inspectProject(`${NS}.Broken`, { rootDir: dir, depth: 1 });
    expect(result.unresolved).toContain(`${NS}.MissingType`);
    expect(result.blocks[`${NS}.MissingType`]).toBeUndefined();
  });

  it("detects expansion cycles", () => {
    const dir = join(TMP, "cycle");
    writeProject(dir, {
      "blocks/Ping.bml": blockXml({
        name: "Ping",
        extra: [
          "  <documentation>ping</documentation>",
          "  <properties>",
          '    <other type="test:Pong"/>',
          "  </properties>",
        ].join("\n"),
      }),
      "blocks/Pong.bml": blockXml({
        name: "Pong",
        extra: [
          "  <documentation>pong</documentation>",
          "  <properties>",
          '    <other type="test:Ping"/>',
          "  </properties>",
        ].join("\n"),
      }),
    });
    const result = inspectProject(`${NS}.Ping`, { rootDir: dir, depth: 2 });
    expect(result.blocks[`${NS}.Ping`]).toBeDefined();
    expect(result.blocks[`${NS}.Pong`]).toBeDefined();
    expect(result.cycles).toContain(`${NS}.Ping`);
  });

  it("truncates after the block budget", () => {
    const dir = join(TMP, "budget");
    writeProject(dir, {
      "blocks/One.bml": blockXml({
        name: "One",
        extra: [
          "  <documentation>one</documentation>",
          "  <properties>",
          '    <next type="test:Two"/>',
          "  </properties>",
        ].join("\n"),
      }),
      "blocks/Two.bml": blockXml({
        name: "Two",
        extra: [
          "  <documentation>two</documentation>",
          "  <properties>",
          '    <next type="test:Three"/>',
          "  </properties>",
        ].join("\n"),
      }),
      "blocks/Three.bml": blockXml({ name: "Three" }),
    });
    const result = inspectProject(`${NS}.One`, { rootDir: dir, depth: 2, maxBlocks: 2 });
    expect(Object.keys(result.blocks).length).toBe(2);
    expect(result.truncated).toContain(`${NS}.Three`);
  });

  it("returns unresolved when the root FQN is missing", () => {
    const dir = join(TMP, "missing-root");
    writeProject(dir, {
      "blocks/Only.bml": blockXml({ name: "Only" }),
    });
    const result = inspectProject(`${NS}.Nope`, { rootDir: dir, depth: 0 });
    expect(result.blocks).toEqual({});
    expect(result.unresolved).toContain(`${NS}.Nope`);
  });
});
