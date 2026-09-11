import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  bootstrapFullProjectRegistry,
  projectSourceRoots,
  rootFqnByFilePath,
} from "@blockml/framework";
import {
  blockToSearchDocument,
  buildIndex,
  buildMemoryIndex,
  documentsFromRegistry,
  getIndexStatus,
  loadIndex,
  rebuildIndex,
  search,
  type SearchDocument,
} from "../src/index.js";

const ROOT = join(import.meta.dirname, "..", "..", "..");
const CORE_FQN = "org.blockml.bml.core.Block";
const TMP = join(import.meta.dirname, ".tmp-search");

function sampleBlock(opts: {
  name: string;
  type: string;
  aliases?: string;
  keywords?: string;
  documentation?: string;
}): string {
  const extra = [
    opts.aliases ? `  <aliases>${opts.aliases}</aliases>` : "",
    opts.keywords ? `  <keywords>${opts.keywords}</keywords>` : "",
    opts.documentation
      ? `  <documentation>${opts.documentation}</documentation>`
      : "  <documentation>placeholder</documentation>",
  ]
    .filter(Boolean)
    .join("\n");
  return [
    '<block xmlns="http://blockml.org/bml"',
    ' xmlns:core="org.blockml.bml.core"',
    ' xmlns:test="com.blockml.test.search">',
    `  <name>${opts.name}</name>`,
    `  <type>test:${opts.name}</type>`,
    "  <baseType>core:Block</baseType>",
    "  <is>search fixture</is>",
    extra,
    "</block>",
    "",
  ].join("\n");
}

function writeProject(dir: string, files: Record<string, string>): void {
  mkdirSync(join(dir, "blocks"), { recursive: true });
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "search-fixture", private: true }, null, 2),
  );
  for (const [rel, contents] of Object.entries(files)) {
    const path = join(dir, rel);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, contents);
  }
}

describe("search documents from BOM", () => {
  it("maps aliases, keywords, and documentation as separate fields", () => {
    const doc: SearchDocument = {
      id: "com.example.Foo",
      fqn: "com.example.Foo",
      name: "Foo",
      aliases: ["Widget"],
      keywords: ["gadget"],
      documentation: "long prose about widgets",
      file: "/tmp/Foo.bml",
    };
    const mapped = blockToSearchDocument(
      {
        name: "Foo",
        type: "com.example.Foo",
        aliases: [{ typeFqn: "org.blockml.bml.meta.Alias", value: "Widget" }],
        keywords: [{ typeFqn: "org.blockml.bml.meta.Keyword", value: "gadget" }],
        documentations: [
          { namespace: "", text: "long prose about widgets", languageFqn: "org.blockml.bml.language.English" },
        ],
        members: [],
        subBlocks: [],
        embeddedBlocks: [],
        compositions: [],
      },
      "/tmp/Foo.bml",
    );
    expect(mapped).toMatchObject({
      fqn: doc.fqn,
      name: doc.name,
      aliases: ["Widget"],
      keywords: ["gadget"],
      documentation: "long prose about widgets",
      file: "/tmp/Foo.bml",
      library: "com.example",
    });
  });
});

describe("search discovery", () => {
  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });
  it("indexes local project BML files under srcDir", async () => {
    const dir = join(TMP, "local");
    writeProject(dir, {
      "blocks/Alpha.bml": sampleBlock({
        name: "Alpha",
        type: "test:Alpha",
        documentation: "unique local discovery phrase xyzzy-alpha",
      }),
    });
    const built = await buildIndex({ rootDir: dir, indexDir: join(dir, ".blockml/search") });
    const fqns = documentsFromRegistry(
      bootstrapFullProjectRegistry({ rootDir: dir }).registry,
    ).map((d) => d.fqn);
    expect(fqns).toContain("com.blockml.test.search.Alpha");
    expect(built.documents).toBeGreaterThan(0);
    const hits = await built.index.search("xyzzy-alpha");
    expect(hits.some((h) => h.fqn === "com.blockml.test.search.Alpha")).toBe(true);
  });

  it("indexes BML from installed BlockML npm packages", async () => {
    const built = await buildIndex({
      rootDir: ROOT,
      indexDir: join(TMP, "npm-index"),
    });
    const fqns = new Set(
      documentsFromRegistry(bootstrapFullProjectRegistry({ rootDir: ROOT }).registry).map(
        (d) => d.fqn,
      ),
    );
    expect(fqns.has(CORE_FQN)).toBe(true);
    const hits = await built.index.search("Block");
    expect(hits.some((h) => h.fqn === CORE_FQN || h.file.includes("node_modules/@blockml/core"))).toBe(
      true,
    );
  }, 20_000);

  it("indexes the same corpus as validate --all / bootstrapFullProjectRegistry", async () => {
    const bootstrap = bootstrapFullProjectRegistry({ rootDir: ROOT });
    const built = await buildIndex({
      rootDir: ROOT,
      indexDir: join(TMP, "parity-index"),
    });
    const registryFqns = [...bootstrap.registry.keys()].sort();
    const searchFqns = documentsFromRegistry(bootstrap.registry)
      .map((d) => d.fqn)
      .sort();
    expect(searchFqns).toEqual(registryFqns);
    expect(built.documents).toBe(registryFqns.length);

    const registryFiles = [...rootFqnByFilePath(bootstrap.registry).keys()].sort();
    expect(built.index.filePaths.sort()).toEqual(registryFiles);
    expect(projectSourceRoots(ROOT).every((root) => root.includes("blocks") || root.includes("packages"))).toBe(
      true,
    );
  }, 20_000);
});

describe("search fields and ranking", () => {
  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it("finds FQN, name, alias, keyword, and documentation", async () => {
    const index = await buildMemoryIndex([
      {
        id: "com.example.NamedBlock",
        fqn: "com.example.NamedBlock",
        name: "NamedBlock",
        aliases: ["NicknameAlias"],
        keywords: ["specialkeyword"],
        documentation: "prose about renderer capabilities in a long paragraph",
        file: "/tmp/NamedBlock.bml",
        library: "com.example",
      },
    ]);
    expect((await index.search("com.example.NamedBlock"))[0]?.fqn).toBe("com.example.NamedBlock");
    expect((await index.search("NamedBlock"))[0]?.fqn).toBe("com.example.NamedBlock");
    expect((await index.search("NicknameAlias"))[0]?.fqn).toBe("com.example.NamedBlock");
    expect((await index.search("specialkeyword"))[0]?.fqn).toBe("com.example.NamedBlock");
    expect((await index.search("renderer capabilities"))[0]?.fqn).toBe("com.example.NamedBlock");
  });

  it("ranks alias and keyword hits above documentation-only hits", async () => {
    const index = await buildMemoryIndex([
      {
        id: "com.example.AliasHit",
        fqn: "com.example.AliasHit",
        name: "AliasHit",
        aliases: ["sharedterm"],
        keywords: [],
        documentation: "unrelated prose",
        file: "/tmp/AliasHit.bml",
      },
      {
        id: "com.example.KeywordHit",
        fqn: "com.example.KeywordHit",
        name: "KeywordHit",
        aliases: [],
        keywords: ["sharedterm"],
        documentation: "unrelated prose",
        file: "/tmp/KeywordHit.bml",
      },
      {
        id: "com.example.DocHit",
        fqn: "com.example.DocHit",
        name: "DocHit",
        aliases: [],
        keywords: [],
        documentation: "this block mentions sharedterm only inside long documentation text",
        file: "/tmp/DocHit.bml",
      },
    ]);
    const hits = await index.search("sharedterm", { limit: 10 });
    expect(hits.length).toBeGreaterThanOrEqual(3);
    const aliasScore = hits.find((h) => h.fqn === "com.example.AliasHit")!.score;
    const keywordScore = hits.find((h) => h.fqn === "com.example.KeywordHit")!.score;
    const docScore = hits.find((h) => h.fqn === "com.example.DocHit")!.score;
    expect(aliasScore).toBeGreaterThan(docScore);
    expect(keywordScore).toBeGreaterThan(docScore);
  });

  it("ranks an exact FQN hit first even when a longer FQN shares the same prefix", async () => {
    const index = await buildMemoryIndex([
      {
        id: "com.example.Block",
        fqn: "com.example.Block",
        name: "Block",
        aliases: [],
        keywords: [],
        documentation: "base block type",
        file: "/tmp/Block.bml",
      },
      {
        id: "com.example.BlockLibrary",
        fqn: "com.example.BlockLibrary",
        name: "BlockLibrary",
        aliases: [],
        keywords: [],
        documentation: "library of blocks that mentions Block many times: Block Block Block",
        file: "/tmp/BlockLibrary.bml",
      },
    ]);
    const hits = await index.search("com.example.Block");
    expect(hits[0]?.fqn).toBe("com.example.Block");
    expect(hits[0]!.score).toBeGreaterThan(hits[1]?.score ?? 0);

    const limited = await index.search("com.example.Block", { limit: 1 });
    expect(limited).toHaveLength(1);
    expect(limited[0]?.fqn).toBe("com.example.Block");
  });

  it("ranks org.blockml.bml.core.Block first in the full project corpus", async () => {
    const built = await buildIndex({
      rootDir: ROOT,
      indexDir: join(TMP, "fqn-rank-index"),
    });
    const hits = await built.index.search(CORE_FQN);
    expect(hits[0]?.fqn).toBe(CORE_FQN);
  });
});

describe("search index persistence and freshness", () => {
  const dir = join(TMP, "persist");

  beforeEach(() => {
    rmSync(dir, { recursive: true, force: true });
    writeProject(dir, {
      "blocks/Gamma.bml": sampleBlock({
        name: "Gamma",
        type: "test:Gamma",
        aliases: "persistalias",
        documentation: "persist roundtrip body",
      }),
    });
  });

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it("saves and loads an index with the same hits", async () => {
    const options = { rootDir: dir, indexDir: join(dir, ".blockml/search") };
    const built = await rebuildIndex(options);
    const before = await built.index.search("persistalias");
    expect(before[0]?.fqn).toBe("com.blockml.test.search.Gamma");

    const loaded = await loadIndex(options);
    expect(loaded).toBeDefined();
    const after = await loaded!.search("persistalias");
    expect(after.map((h) => h.fqn)).toEqual(before.map((h) => h.fqn));
  });

  it("ranks an exact FQN first after loadIndex", async () => {
    const options = { rootDir: dir, indexDir: join(dir, ".blockml/search") };
    await rebuildIndex(options);
    const loaded = await loadIndex(options);
    expect(loaded).toBeDefined();
    const hits = await loaded!.search("com.blockml.test.search.Gamma");
    expect(hits[0]?.fqn).toBe("com.blockml.test.search.Gamma");
  });

  it("rebuildIndex replaces the persisted index", async () => {
    const options = { rootDir: dir, indexDir: join(dir, ".blockml/search") };
    await rebuildIndex(options);
    writeFileSync(
      join(dir, "blocks/Delta.bml"),
      sampleBlock({
        name: "Delta",
        type: "test:Delta",
        documentation: "brand-new-delta-term",
      }),
    );
    const rebuilt = await rebuildIndex(options);
    const hits = await rebuilt.index.search("brand-new-delta-term");
    expect(hits.some((h) => h.fqn === "com.blockml.test.search.Delta")).toBe(true);
  });

  it("search() creates an index when none exists", async () => {
    const options = { rootDir: dir, indexDir: join(dir, ".blockml/search") };
    expect((await getIndexStatus(options)).state).toBe("missing");
    const hits = await search("persistalias", options);
    expect(hits[0]?.fqn).toBe("com.blockml.test.search.Gamma");
    expect((await getIndexStatus(options)).state).toBe("ready");
  });

  it("marks the index stale after package.json changes and rebuilds on search", async () => {
    const options = { rootDir: dir, indexDir: join(dir, ".blockml/search") };
    await rebuildIndex(options);
    expect((await getIndexStatus(options)).state).toBe("ready");

    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "search-fixture", private: true, version: "2.0.0" }, null, 2),
    );
    expect((await getIndexStatus(options)).state).toBe("stale");

    await search("persistalias", options);
    expect((await getIndexStatus(options)).state).toBe("ready");
  });

  it("marks the index stale when a corpus file is added", async () => {
    const options = { rootDir: dir, indexDir: join(dir, ".blockml/search") };
    await rebuildIndex(options);
    writeFileSync(
      join(dir, "blocks/Epsilon.bml"),
      sampleBlock({
        name: "Epsilon",
        type: "test:Epsilon",
        documentation: "new file",
      }),
    );
    expect((await getIndexStatus(options)).state).toBe("stale");
  });
});
