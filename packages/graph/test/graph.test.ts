import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { bootstrapFullProjectRegistry, projectSourceRoots } from "@blockml/framework";
import {
  buildMemoryIndex,
  collectNamedTypes,
  getIndexStatus,
  graphDataFromRegistry,
  graphSchema,
  openGraph,
  rebuildIndex,
} from "../src/index.js";

const ROOT = join(import.meta.dirname, "..", "..", "..");
const CORE_FQN = "org.blockml.bml.core.Block";
const TMP = join(import.meta.dirname, ".tmp-graph");

function sampleBlock(opts: {
  name: string;
  ns?: string;
  baseType?: string;
  extra?: string;
}): string {
  const ns = opts.ns ?? "com.blockml.test.graph";
  return [
    '<block xmlns="http://blockml.org/bml"',
    ' xmlns:core="org.blockml.bml.core"',
    ' xmlns:type="org.blockml.bml.type"',
    ` xmlns:test="${ns}">`,
    `  <name>${opts.name}</name>`,
    `  <type>test:${opts.name}</type>`,
    `  <baseType>${opts.baseType ?? "core:Block"}</baseType>`,
    "  <is>graph fixture</is>",
    "  <documentation>graph fixture</documentation>",
    opts.extra ?? "",
    "</block>",
    "",
  ].join("\n");
}

function writeProject(dir: string, files: Record<string, string>): void {
  mkdirSync(join(dir, "blocks"), { recursive: true });
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "graph-fixture", private: true }, null, 2),
  );
  for (const [rel, contents] of Object.entries(files)) {
    const path = join(dir, rel);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, contents);
  }
}

describe("graph mapping", () => {
  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it("maps authored members and type edges, not inherited members", () => {
    writeProject(TMP, {
      "blocks/Size3D.bml": sampleBlock({
        name: "Size3D",
        extra: [
          "  <properties>",
          '    <x type="core:Number"><documentation>x</documentation></x>',
          "  </properties>",
        ].join("\n"),
      }),
      "blocks/PhysicalObject.bml": sampleBlock({
        name: "PhysicalObject",
        extra: [
          "  <properties>",
          '    <size type="test:Size3D"><documentation>size</documentation></size>',
          "  </properties>",
        ].join("\n"),
      }),
      "blocks/Wall.bml": sampleBlock({
        name: "Wall",
        baseType: "test:PhysicalObject",
      }),
    });
    const { registry } = bootstrapFullProjectRegistry({ rootDir: TMP });
    const data = graphDataFromRegistry(registry, { rootDir: TMP });
    const wall = "com.blockml.test.graph.Wall";
    const physical = "com.blockml.test.graph.PhysicalObject";
    const size3d = "com.blockml.test.graph.Size3D";
    expect(data.blocks.some((block) => block.fqn === wall && block.resolved)).toBe(true);
    expect(
      data.edges.some((edge) => edge.relation === "BASE_TYPE" && edge.from === wall && edge.to === physical),
    ).toBe(true);
    expect(
      data.members.some((member) => member.id === `${physical}#property:size`),
    ).toBe(true);
    expect(data.members.some((member) => member.ownerFqn === wall)).toBe(false);
    expect(
      data.edges.some(
        (edge) =>
          edge.relation === "MEMBER_TYPE" &&
          edge.from === `${physical}#property:size` &&
          edge.to === size3d,
      ),
    ).toBe(true);
    expect(data.blocks.find((block) => block.fqn === wall)?.origin).toBe("workspace");
  });

  it("creates stub nodes for unresolved type FQNs", () => {
    writeProject(TMP, {
      "blocks/MissingRef.bml": sampleBlock({
        name: "MissingRef",
        extra: [
          "  <properties>",
          '    <ghost type="test:DoesNotExist"><documentation>ghost</documentation></ghost>',
          "  </properties>",
        ].join("\n"),
      }),
    });
    const { registry } = bootstrapFullProjectRegistry({ rootDir: TMP });
    const data = graphDataFromRegistry(registry, { rootDir: TMP });
    const stub = data.blocks.find((block) => block.fqn === "com.blockml.test.graph.DoesNotExist");
    expect(stub?.resolved).toBe(false);
    expect(stub?.origin).toBe("unresolved");
    expect(
      data.edges.some(
        (edge) => edge.relation === "MEMBER_TYPE" && edge.to === "com.blockml.test.graph.DoesNotExist",
      ),
    ).toBe(true);
  });

  it("extracts multiple named types from unions and generics", () => {
    const refs = collectNamedTypes({
      kind: "union",
      alternatives: [
        { kind: "named", fqn: "org.blockml.bml.core.Text" },
        {
          kind: "named",
          fqn: "org.blockml.bml.type.TypeReferenceEntity",
          typeArguments: [{ kind: "named", fqn: "org.blockml.bml.core.Block" }],
        },
      ],
    });
    expect(refs.map((ref) => ref.fqn).sort()).toEqual([
      "org.blockml.bml.core.Block",
      "org.blockml.bml.core.Text",
      "org.blockml.bml.type.TypeReferenceEntity",
    ]);
  });

  it("maps the same resolved blocks as validate --all / bootstrapFullProjectRegistry", () => {
    const bootstrap = bootstrapFullProjectRegistry({ rootDir: ROOT });
    const data = graphDataFromRegistry(bootstrap.registry, { rootDir: ROOT });
    const registryFqns = [...bootstrap.registry.keys()].sort();
    const graphFqns = data.blocks
      .filter((block) => block.resolved)
      .map((block) => block.fqn)
      .sort();
    expect(graphFqns).toEqual(registryFqns);
    expect(projectSourceRoots(ROOT).length).toBeGreaterThan(0);
  });
});

describe("graph semantic API", () => {
  afterEach(async () => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it("answers uses, usedBy, ancestors, members, path, query, and schema", async () => {
    writeProject(TMP, {
      "blocks/Size3D.bml": sampleBlock({
        name: "Size3D",
        extra: [
          "  <properties>",
          '    <x type="core:Number"><documentation>x</documentation></x>',
          "  </properties>",
        ].join("\n"),
      }),
      "blocks/PhysicalObject.bml": sampleBlock({
        name: "PhysicalObject",
        extra: [
          "  <properties>",
          '    <size type="test:Size3D"><documentation>size</documentation></size>',
          "  </properties>",
        ].join("\n"),
      }),
      "blocks/Wall.bml": sampleBlock({
        name: "Wall",
        baseType: "test:PhysicalObject",
      }),
    });
    const { registry } = bootstrapFullProjectRegistry({ rootDir: TMP });
    const index = await buildMemoryIndex(registry, { rootDir: TMP });
    try {
      const wall = "com.blockml.test.graph.Wall";
      const physical = "com.blockml.test.graph.PhysicalObject";
      const size3d = "com.blockml.test.graph.Size3D";
      const numberFqn = "org.blockml.bml.core.Number";

      const uses = await index.uses(wall);
      expect(uses.some((hit) => hit.node.fqn === physical && hit.relation === "BASE_TYPE")).toBe(true);

      const usedBy = await index.usedBy(size3d);
      expect(usedBy.some((hit) => hit.node.fqn === physical && hit.via?.displayFqn === `${physical}.size`)).toBe(
        true,
      );

      const ancestorFqns = (await index.ancestors(wall)).map((node) => node.fqn);
      expect(ancestorFqns).toContain(physical);
      expect(ancestorFqns).toContain(CORE_FQN);

      const wallMembers = await index.members(wall);
      const sizeMember = wallMembers.find((member) => member.node.name === "size");
      expect(sizeMember?.inheritedFrom).toBe(physical);

      const path = await index.path(wall, numberFqn);
      expect(path).toBeDefined();
      expect(path!.hops.every((hop) => hop.direction === "outgoing")).toBe(true);
      expect(path!.hops.some((hop) => hop.node.kind === "member")).toBe(true);
      expect(path!.hops.at(-1)?.node.fqn).toBe(numberFqn);

      const sizePath = await index.path(physical, size3d);
      expect(sizePath?.hops.some((hop) => hop.relation === "MEMBER_TYPE")).toBe(true);
      expect(await index.path(size3d, physical)).toBeUndefined();
      expect(await index.path(numberFqn, wall)).toBeUndefined();
      expect(await index.block(wall)).toMatchObject({ fqn: wall, kind: "block" });
      expect(await index.block("com.blockml.test.graph.DoesNotExist")).toBeUndefined();

      const schema = index.schema();
      expect(schema.relations).toContain("BASE_TYPE");
      expect(schema.relations).toContain("MEMBER_TYPE");
      expect(graphSchema().description.length).toBeGreaterThan(0);

      const queried = await index.query(
        "MATCH (a:Block)-[:BASE_TYPE*1..]->(b:Block) WHERE b.fqn = $fqn RETURN a.fqn ORDER BY a.fqn",
        { fqn: CORE_FQN },
      );
      expect(queried.rows.some((row) => row.values.includes(wall))).toBe(true);
    } finally {
      await index.close();
    }
  });
});

describe("graph index persistence", () => {
  const dir = join(TMP, "persist");

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it("rebuilds when missing and loads a ready index", async () => {
    writeProject(dir, {
      "blocks/Gamma.bml": sampleBlock({ name: "Gamma" }),
    });
    const options = { rootDir: dir, indexDir: join(dir, ".blockml/graph") };
    expect((await getIndexStatus(options)).state).toBe("missing");
    const opened = await openGraph(options);
    expect(opened.blocks).toBeGreaterThan(0);
    expect((await getIndexStatus(options)).state).toBe("ready");
    await opened.index.close();

    const loaded = await openGraph(options);
    const uses = await loaded.index.uses("com.blockml.test.graph.Gamma");
    expect(uses.some((hit) => hit.relation === "BASE_TYPE")).toBe(true);
    await loaded.index.close();
  });

  it("marks the index stale after package.json changes", async () => {
    writeProject(dir, {
      "blocks/Gamma.bml": sampleBlock({ name: "Gamma" }),
    });
    const options = { rootDir: dir, indexDir: join(dir, ".blockml/graph") };
    const built = await rebuildIndex(options);
    await built.index.close();
    expect((await getIndexStatus(options)).state).toBe("ready");
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "graph-fixture", private: true, version: "2.0.0" }, null, 2),
    );
    expect((await getIndexStatus(options)).state).toBe("stale");
  });

  it("openGraph indexes a local project including core types", async () => {
    writeProject(dir, {
      "blocks/Gamma.bml": sampleBlock({ name: "Gamma" }),
    });
    const options = { rootDir: dir, indexDir: join(dir, ".blockml/graph-core") };
    const built = await openGraph(options);
    try {
      const uses = await built.index.uses("com.blockml.test.graph.Gamma");
      expect(uses.some((hit) => hit.node.fqn === CORE_FQN)).toBe(true);
      expect(built.blocks).toBeGreaterThan(0);
    } finally {
      await built.index.close();
    }
  });
});
