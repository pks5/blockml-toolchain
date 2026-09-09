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
    ' xmlns:bml="org.blockml.bml.annotation.BmlAnnotation"',
    ' xmlns:lang="org.blockml.bml.language"',
    ' xmlns:cap="org.blockml.bml.capability"',
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
          '    <address type="test:Address">',
          "      <documentation>shipping address</documentation>",
          "    </address>",
          "  </properties>",
        ].join("\n"),
      }),
    });
    const d0 = inspectProject(`${NS}.Customer`, { rootDir: dir, depth: 0 });
    expect(d0.depth).toBe(0);
    expect(d0.root).toBe(`${NS}.Customer`);
    expect(Object.keys(d0.blocks)).toEqual([`${NS}.Customer`]);
    const customer = d0.blocks[`${NS}.Customer`];
    const addressMember = customer?.properties?.find((m) => m.name === "address");
    expect(addressMember?.type?.ref).toBe(`${NS}.Address`);
    expect(addressMember?.documentation).toBe("shipping address");
    expect(addressMember?.documentationTruncated).toBeUndefined();
    expect(addressMember && "kind" in addressMember).toBe(false);
    expect(customer && "members" in customer).toBe(false);
    expect(customer?.capabilities).toBeUndefined();

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
    const label = result.blocks[`${NS}.Child`]?.properties?.find((m) => m.name === "label");
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
    const n = result.blocks[`${NS}.Counted`]?.properties?.find((m) => m.name === "n");
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

  it("projects enum composition literals as instances with id", () => {
    const dir = join(TMP, "enum");
    writeProject(dir, {
      "blocks/Color.bml": blockXml({
        name: "Color",
        baseType: "type:EnumType",
        extra: [
          "  <documentation>color</documentation>",
          "  <aggregations>",
          "    <values>",
          "      <composition>",
          '        <test:Color bml:id="Red" />',
          '        <test:Color bml:id="Blue" />',
          "      </composition>",
          "    </values>",
          "  </aggregations>",
        ].join("\n"),
      }),
    });
    const result = inspectProject(`${NS}.Color`, { rootDir: dir, depth: 0 });
    const values = result.blocks[`${NS}.Color`]?.aggregations?.find((m) => m.name === "values");
    expect(values?.instances?.map((item) => item.id)).toEqual(["Red", "Blue"]);
    expect(values?.instances?.every((item) => item.type === `${NS}.Color`)).toBe(true);
  });

  it("projects library-style catalog FQNs on aggregations", () => {
    const dir = join(TMP, "catalog");
    writeProject(dir, {
      "blocks/Address.bml": blockXml({ name: "Address" }),
      "blocks/Catalog.bml": blockXml({
        name: "Catalog",
        extra: [
          "  <documentation>catalog</documentation>",
          "  <aggregations>",
          "    <blocks>",
          "      <composition>",
          "        <test:Address />",
          "        <test:Catalog />",
          "      </composition>",
          "    </blocks>",
          "  </aggregations>",
        ].join("\n"),
      }),
    });
    const result = inspectProject(`${NS}.Catalog`, { rootDir: dir, depth: 0 });
    const blocks = result.blocks[`${NS}.Catalog`]?.aggregations?.find((m) => m.name === "blocks");
    expect(blocks?.instances?.map((item) => item.type)).toEqual([`${NS}.Address`, `${NS}.Catalog`]);
  });

  it("projects nested composition instances with member values", () => {
    const dir = join(TMP, "nested");
    writeProject(dir, {
      "blocks/Task.bml": blockXml({
        name: "Task",
        extra: [
          "  <documentation>task</documentation>",
          "  <properties>",
          '    <instructions type="type:Text"/>',
          "  </properties>",
        ].join("\n"),
      }),
      "blocks/Stage.bml": blockXml({
        name: "Stage",
        extra: [
          "  <documentation>stage</documentation>",
          "  <properties>",
          '    <name type="type:Text"/>',
          "  </properties>",
          "  <aggregations>",
          '    <task type="test:Task"/>',
          "  </aggregations>",
        ].join("\n"),
      }),
      "blocks/Pipeline.bml": blockXml({
        name: "Pipeline",
        extra: [
          "  <documentation>pipeline</documentation>",
          "  <aggregations>",
          "    <stages>",
          "      <composition>",
          '        <test:Stage name="Build">',
          "          <task>",
          "            <composition>",
          '              <test:Task instructions="compile" />',
          "            </composition>",
          "          </task>",
          "        </test:Stage>",
          "      </composition>",
          "    </stages>",
          "  </aggregations>",
        ].join("\n"),
      }),
    });
    const result = inspectProject(`${NS}.Pipeline`, { rootDir: dir, depth: 0 });
    const stages = result.blocks[`${NS}.Pipeline`]?.aggregations?.find((m) => m.name === "stages");
    expect(stages?.instances).toEqual([
      {
        type: `${NS}.Stage`,
        members: { name: "Build" },
        aggregations: {
          task: [
            {
              type: `${NS}.Task`,
              members: { instructions: "compile" },
            },
          ],
        },
      },
    ]);
  });

  it("projects authored documentation see references without expanding them", () => {
    const dir = join(TMP, "refs");
    writeProject(dir, {
      "blocks/Peer.bml": blockXml({ name: "Peer" }),
      "blocks/Topic.bml": blockXml({
        name: "Topic",
        extra: [
          "  <documentation>topic</documentation>",
          "  <references>",
          '    <see type="test:Peer" relation="ReadNext" />',
          '    <see type="test:Peer" />',
          '    <see url="https://blockml.org/docs" relation="SeeAlso" />',
          "  </references>",
        ].join("\n"),
      }),
    });
    const result = inspectProject(`${NS}.Topic`, { rootDir: dir, depth: 1 });
    const topic = result.blocks[`${NS}.Topic`];
    expect(topic?.references).toEqual([
      { ref: `${NS}.Peer`, relation: "ReadNext" },
      { ref: `${NS}.Peer`, relation: "SeeAlso" },
      { url: "https://blockml.org/docs", relation: "SeeAlso" },
    ]);
    expect(topic?.referencesTruncated).toBeUndefined();
    expect(result.blocks[`${NS}.Peer`]).toBeUndefined();
  });

  it("caps references at 8 and sets referencesTruncated to the remaining count", () => {
    const dir = join(TMP, "refs-cap");
    const sees = Array.from({ length: 11 }, (_, i) => `    <see type="test:Peer${i}" />`).join("\n");
    const peers = Object.fromEntries(
      Array.from({ length: 11 }, (_, i) => [`blocks/Peer${i}.bml`, blockXml({ name: `Peer${i}` })]),
    );
    writeProject(dir, {
      ...peers,
      "blocks/Hub.bml": blockXml({
        name: "Hub",
        extra: ["  <documentation>hub</documentation>", "  <references>", sees, "  </references>"].join(
          "\n",
        ),
      }),
    });
    const result = inspectProject(`${NS}.Hub`, { rootDir: dir, depth: 0 });
    const hub = result.blocks[`${NS}.Hub`];
    expect(hub?.references).toHaveLength(8);
    expect(hub?.references?.[0]?.ref).toBe(`${NS}.Peer0`);
    expect(hub?.references?.[7]?.ref).toBe(`${NS}.Peer7`);
    expect(hub?.referencesTruncated).toBe(3);
  });

  it("marks truncated documentation", () => {
    const dir = join(TMP, "docs");
    const longDoc = `inspect fixture ${"x".repeat(420)}`;
    writeProject(dir, {
      "blocks/Verbose.bml": blockXml({
        name: "Verbose",
        extra: `  <documentation>${longDoc}</documentation>`,
      }),
    });
    const result = inspectProject(`${NS}.Verbose`, { rootDir: dir, depth: 0 });
    const block = result.blocks[`${NS}.Verbose`];
    expect(block?.documentationTruncated).toBe(true);
    expect(block?.documentation?.endsWith("…")).toBe(true);
    expect(block?.documentation?.startsWith("inspect fixture ")).toBe(true);
    expect(block?.documentation?.length).toBe(401);
  });

  it("truncates member documentation and omits it when empty", () => {
    const dir = join(TMP, "member-docs");
    const longDoc = `member fixture ${"y".repeat(420)}`;
    writeProject(dir, {
      "blocks/Noted.bml": blockXml({
        name: "Noted",
        extra: [
          "  <documentation>noted</documentation>",
          "  <properties>",
          '    <quiet type="type:Text"/>',
          `    <loud type="type:Text"><documentation>${longDoc}</documentation></loud>`,
          "  </properties>",
        ].join("\n"),
      }),
    });
    const result = inspectProject(`${NS}.Noted`, { rootDir: dir, depth: 0 });
    const quiet = result.blocks[`${NS}.Noted`]?.properties?.find((m) => m.name === "quiet");
    const loud = result.blocks[`${NS}.Noted`]?.properties?.find((m) => m.name === "loud");
    expect(quiet?.documentation).toBeUndefined();
    expect(loud?.documentationTruncated).toBe(true);
    expect(loud?.documentation?.startsWith("member fixture ")).toBe(true);
    expect(loud?.documentation?.endsWith("…")).toBe(true);
    expect(loud?.documentation?.length).toBe(401);
  });

  it("projects capability implementation language and truncated source", () => {
    const dir = join(TMP, "impl");
    const longBody = `Do the thing. ${"x".repeat(420)}`;
    writeProject(dir, {
      "blocks/Runner.bml": blockXml({
        name: "Runner",
        extra: [
          "  <documentation>runner</documentation>",
          "  <capabilities>",
          '    <go type="cap:Action">',
          '      <implementation language="lang:English">',
          `        ${longBody}`,
          "      </implementation>",
          "    </go>",
          "  </capabilities>",
        ].join("\n"),
      }),
    });
    const result = inspectProject(`${NS}.Runner`, { rootDir: dir, depth: 0 });
    const go = result.blocks[`${NS}.Runner`]?.capabilities?.find((m) => m.name === "go");
    expect(go && "kind" in go).toBe(false);
    expect(go?.implementation?.language).toBe("English");
    expect(go?.implementation?.sourceTruncated).toBe(true);
    expect(go?.implementation?.source.startsWith("Do the thing.")).toBe(true);
    expect(go?.implementation?.source.endsWith("…")).toBe(true);
  });

  it("projects genericTypes without inventing subBlocks", () => {
    const dir = join(TMP, "generics");
    writeProject(dir, {
      "blocks/Widget.bml": blockXml({ name: "Widget" }),
      "blocks/Box.bml": blockXml({
        name: "Box",
        extra: [
          "  <documentation>box</documentation>",
          "  <genericTypes>",
          '    <T baseType="core:Block" defaultType="test:Widget">',
          "      <documentation>payload type</documentation>",
          "    </T>",
          "  </genericTypes>",
          "  <properties>",
          '    <item type="T"/>',
          "  </properties>",
        ].join("\n"),
      }),
    });
    const d0 = inspectProject(`${NS}.Box`, { rootDir: dir, depth: 0 });
    const box = d0.blocks[`${NS}.Box`];
    expect(box?.subBlocks).toBeUndefined();
    expect(box?.genericTypes).toEqual([
      {
        name: "T",
        baseType: { kind: "named", ref: "org.blockml.bml.core.Block" },
        defaultType: { kind: "named", ref: `${NS}.Widget` },
        documentation: "payload type",
      },
    ]);
    const item = box?.properties?.find((m) => m.name === "item");
    expect(item?.type).toEqual({ kind: "genericParam", name: "T" });
    expect(d0.blocks[`${NS}.Widget`]).toBeUndefined();
    expect(d0.blocks["org.blockml.bml.core.Block"]).toBeUndefined();

    const d1 = inspectProject(`${NS}.Box`, { rootDir: dir, depth: 1 });
    expect(d1.blocks[`${NS}.Widget`]).toBeDefined();
    expect(d1.blocks["org.blockml.bml.core.Block"]).toBeUndefined();
  });

  it("keeps generic arguments on baseType and expands the argument, not the parent", () => {
    const dir = join(TMP, "generic-base");
    writeProject(dir, {
      "blocks/Payload.bml": blockXml({ name: "Payload" }),
      "blocks/Holder.bml": blockXml({
        name: "Holder",
        extra: [
          "  <documentation>holder</documentation>",
          "  <genericTypes>",
          '    <T baseType="core:Block" />',
          "  </genericTypes>",
          "  <properties>",
          '    <item type="T"/>',
          "  </properties>",
        ].join("\n"),
      }),
      "blocks/Filled.bml": blockXml({
        name: "Filled",
        baseType: "test:Holder(test:Payload)",
        extra: "  <documentation>filled</documentation>",
      }),
    });
    const d0 = inspectProject(`${NS}.Filled`, { rootDir: dir, depth: 0 });
    expect(d0.blocks[`${NS}.Filled`]?.baseType).toEqual({
      kind: "generic",
      ref: `${NS}.Holder`,
      args: [{ kind: "named", ref: `${NS}.Payload` }],
    });
    expect(d0.blocks[`${NS}.Filled`]?.subBlocks).toBeUndefined();
    expect(d0.blocks[`${NS}.Holder`]).toBeUndefined();
    expect(d0.blocks[`${NS}.Payload`]).toBeUndefined();

    const d1 = inspectProject(`${NS}.Filled`, { rootDir: dir, depth: 1 });
    expect(d1.blocks[`${NS}.Payload`]).toBeDefined();
    expect(d1.blocks[`${NS}.Holder`]).toBeUndefined();
  });
});
