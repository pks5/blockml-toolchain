import { Database, Connection, type QueryResult } from "@ladybugdb/core";
import { GRAPH_SCHEMA_DDL } from "./schema.js";
import type { GraphData, MappedBlock, MappedEdge, MappedMember } from "./mapper.js";
import type { GraphStore } from "./store.js";

async function rowsFromResult(result: QueryResult | QueryResult[]): Promise<{
  columns: string[];
  rows: unknown[][];
}> {
  const results = Array.isArray(result) ? result : [result];
  const columns = results[0] ? await results[0].getColumnNames() : [];
  const rows: unknown[][] = [];
  for (const item of results) {
    const records = await item.getAll();
    const names = await item.getColumnNames();
    for (const record of records) {
      rows.push(names.map((name) => record[name]));
    }
    item.close();
  }
  return { columns, rows };
}

export class LadybugStore implements GraphStore {
  private readonly database: Database;
  private readonly connection: Connection;
  private closed = false;

  constructor(database: Database, connection: Connection) {
    this.database = database;
    this.connection = connection;
  }

  async exec(cypher: string, params?: Record<string, unknown>): Promise<unknown[][]> {
    const { rows } = await this.execWithColumns(cypher, params);
    return rows;
  }

  async execWithColumns(
    cypher: string,
    params?: Record<string, unknown>,
  ): Promise<{ columns: string[]; rows: unknown[][] }> {
    if (params && Object.keys(params).length > 0) {
      const prepared = await this.connection.prepare(cypher);
      if (!prepared.isSuccess()) {
        throw new Error(prepared.getErrorMessage() || `Failed to prepare: ${cypher}`);
      }
      const result = await this.connection.execute(
        prepared,
        params as Record<string, string | number | boolean>,
      );
      return rowsFromResult(result);
    }
    const result = await this.connection.query(cypher);
    return rowsFromResult(result);
  }

  async close(): Promise<void> {
    if (this.closed) {
      return;
    }
    this.closed = true;
    await this.connection.close();
    await this.database.close();
  }
}

export async function openLadybugStore(databasePath: string): Promise<LadybugStore> {
  const database = new Database(databasePath);
  await database.init();
  const connection = new Connection(database);
  await connection.init();
  return new LadybugStore(database, connection);
}

export async function createLadybugStore(databasePath: string): Promise<LadybugStore> {
  const store = await openLadybugStore(databasePath);
  for (const ddl of GRAPH_SCHEMA_DDL) {
    await store.exec(ddl);
  }
  return store;
}

async function insertBlocks(store: LadybugStore, blocks: MappedBlock[]): Promise<void> {
  const cypher =
    "CREATE (:Block {fqn: $fqn, name: $name, file: $file, library: $library, origin: $origin, resolved: $resolved, abstract: $abstract})";
  for (const block of blocks) {
    await store.exec(cypher, {
      fqn: block.fqn,
      name: block.name,
      file: block.file,
      library: block.library,
      origin: block.origin,
      resolved: block.resolved,
      abstract: block.abstract,
    });
  }
}

async function insertMembers(store: LadybugStore, members: MappedMember[]): Promise<void> {
  const cypher =
    "CREATE (:Member {id: $id, ownerFqn: $ownerFqn, name: $name, kind: $kind, displayFqn: $displayFqn, file: $file, line: $line, origin: $origin})";
  for (const member of members) {
    await store.exec(cypher, {
      id: member.id,
      ownerFqn: member.ownerFqn,
      name: member.name,
      kind: member.kind,
      displayFqn: member.displayFqn,
      file: member.file,
      line: member.line,
      origin: member.origin,
    });
  }
}

const BLOCK_TO_BLOCK = new Set(["BASE_TYPE", "CONTRACT", "HAS_SUBBLOCK"]);
const MEMBER_TO_BLOCK = new Set(["MEMBER_TYPE", "INPUT_TYPE", "OUTPUT_TYPE", "THROWS"]);

async function insertEdges(store: LadybugStore, edges: MappedEdge[]): Promise<void> {
  for (const edge of edges) {
    if (BLOCK_TO_BLOCK.has(edge.relation)) {
      await store.exec(
        `MATCH (a:Block {fqn: $from}), (b:Block {fqn: $to}) CREATE (a)-[:${edge.relation} {file: $file, line: $line}]->(b)`,
        { from: edge.from, to: edge.to, file: edge.file, line: edge.line },
      );
      continue;
    }
    if (edge.relation === "HAS_MEMBER") {
      await store.exec(
        "MATCH (a:Block {fqn: $from}), (m:Member {id: $to}) CREATE (a)-[:HAS_MEMBER {file: $file, line: $line}]->(m)",
        { from: edge.from, to: edge.to, file: edge.file, line: edge.line },
      );
      continue;
    }
    if (edge.relation === "MEMBER_TYPE") {
      await store.exec(
        "MATCH (m:Member {id: $from}), (b:Block {fqn: $to}) CREATE (m)-[:MEMBER_TYPE {file: $file, line: $line, cardinality: $cardinality}]->(b)",
        {
          from: edge.from,
          to: edge.to,
          file: edge.file,
          line: edge.line,
          cardinality: edge.cardinality,
        },
      );
      continue;
    }
    if (MEMBER_TO_BLOCK.has(edge.relation)) {
      await store.exec(
        `MATCH (m:Member {id: $from}), (b:Block {fqn: $to}) CREATE (m)-[:${edge.relation} {file: $file, line: $line}]->(b)`,
        {
          from: edge.from,
          to: edge.to,
          file: edge.file,
          line: edge.line,
        },
      );
    }
  }
}

export async function populateStore(store: LadybugStore, data: GraphData): Promise<void> {
  await insertBlocks(store, data.blocks);
  await insertMembers(store, data.members);
  await insertEdges(store, data.edges);
}
