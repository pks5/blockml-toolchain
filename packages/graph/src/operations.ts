import type {
  GraphMember,
  GraphNeighbor,
  GraphNode,
  GraphOrigin,
  GraphPath,
  GraphPathHop,
  GraphQueryResult,
  GraphRelation,
  MemberKind,
} from "./types.js";
import { DEFAULT_GRAPH_DEPTH } from "./types.js";
import { graphSchema } from "./schema.js";
import type { GraphStore } from "./store.js";

const BLOCK_TO_BLOCK: GraphRelation[] = ["BASE_TYPE", "CONTRACT", "HAS_SUBBLOCK"];
const MEMBER_TO_BLOCK: GraphRelation[] = ["MEMBER_TYPE", "INPUT_TYPE", "OUTPUT_TYPE", "THROWS"];

function asString(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

function asBool(value: unknown): boolean {
  return value === true || value === "true" || value === 1;
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function originOf(value: unknown): GraphOrigin {
  if (value === "workspace" || value === "dependency" || value === "unresolved") {
    return value;
  }
  return "unresolved";
}

function memberKindOf(value: unknown): MemberKind | undefined {
  if (
    value === "property" ||
    value === "aggregation" ||
    value === "association" ||
    value === "capability"
  ) {
    return value;
  }
  return undefined;
}

function blockNodeFromRow(
  fqn: unknown,
  name: unknown,
  file: unknown,
  library: unknown,
  origin: unknown,
  resolved: unknown,
): GraphNode {
  const node: GraphNode = {
    kind: "block",
    fqn: asString(fqn),
    name: asString(name),
    file: asString(file),
    origin: originOf(origin),
    resolved: asBool(resolved),
  };
  const lib = asString(library);
  if (lib) {
    node.library = lib;
  }
  return node;
}

function memberNodeFromRow(
  id: unknown,
  name: unknown,
  file: unknown,
  origin: unknown,
  kind: unknown,
  displayFqn: unknown,
): GraphNode {
  const node: GraphNode = {
    kind: "member",
    fqn: asString(id),
    name: asString(name),
    file: asString(file),
    origin: originOf(origin),
    resolved: true,
  };
  const memberKind = memberKindOf(kind);
  if (memberKind) {
    node.memberKind = memberKind;
  }
  const display = asString(displayFqn);
  if (display) {
    node.displayFqn = display;
  }
  return node;
}

function optionalLine(line: unknown): number | undefined {
  const n = asNumber(line);
  return n > 0 ? n : undefined;
}

function withEdgeMeta(
  neighbor: GraphNeighbor,
  file: unknown,
  line: unknown,
  via?: GraphNode,
): GraphNeighbor {
  const edgeFile = asString(file);
  if (edgeFile) {
    neighbor.file = edgeFile;
  }
  const edgeLine = optionalLine(line);
  if (edgeLine !== undefined) {
    neighbor.line = edgeLine;
  }
  if (via) {
    neighbor.via = via;
  }
  return neighbor;
}

function depthOf(depth?: number): number {
  if (depth === undefined || !Number.isFinite(depth) || depth < 1) {
    return DEFAULT_GRAPH_DEPTH;
  }
  return Math.floor(depth);
}

async function loadBlock(store: GraphStore, fqn: string): Promise<GraphNode | undefined> {
  const rows = await store.exec(
    "MATCH (b:Block {fqn: $fqn}) RETURN b.fqn, b.name, b.file, b.library, b.origin, b.resolved",
    { fqn },
  );
  const row = rows[0];
  if (!row) {
    return undefined;
  }
  return blockNodeFromRow(row[0], row[1], row[2], row[3], row[4], row[5]);
}

export async function uses(store: GraphStore, fqn: string): Promise<GraphNeighbor[]> {
  const out: GraphNeighbor[] = [];
  for (const relation of BLOCK_TO_BLOCK) {
    const rows = await store.exec(
      `MATCH (a:Block {fqn: $fqn})-[r:${relation}]->(b:Block)
       RETURN b.fqn, b.name, b.file, b.library, b.origin, b.resolved, r.file, r.line
       ORDER BY b.fqn`,
      { fqn },
    );
    for (const row of rows) {
      out.push(
        withEdgeMeta(
          {
            node: blockNodeFromRow(row[0], row[1], row[2], row[3], row[4], row[5]),
            relation,
            direction: "outgoing",
          },
          row[6],
          row[7],
        ),
      );
    }
  }
  for (const relation of MEMBER_TO_BLOCK) {
    const rows = await store.exec(
      `MATCH (a:Block {fqn: $fqn})-[:HAS_MEMBER]->(m:Member)-[r:${relation}]->(b:Block)
       RETURN b.fqn, b.name, b.file, b.library, b.origin, b.resolved, r.file, r.line,
              m.id, m.name, m.file, m.origin, m.kind, m.displayFqn
       ORDER BY b.fqn, m.displayFqn`,
      { fqn },
    );
    for (const row of rows) {
      out.push(
        withEdgeMeta(
          {
            node: blockNodeFromRow(row[0], row[1], row[2], row[3], row[4], row[5]),
            relation,
            direction: "outgoing",
          },
          row[6],
          row[7],
          memberNodeFromRow(row[8], row[9], row[10], row[11], row[12], row[13]),
        ),
      );
    }
  }
  return out;
}

export async function usedBy(store: GraphStore, fqn: string): Promise<GraphNeighbor[]> {
  const out: GraphNeighbor[] = [];
  for (const relation of BLOCK_TO_BLOCK) {
    const rows = await store.exec(
      `MATCH (a:Block)-[r:${relation}]->(b:Block {fqn: $fqn})
       RETURN a.fqn, a.name, a.file, a.library, a.origin, a.resolved, r.file, r.line
       ORDER BY a.fqn`,
      { fqn },
    );
    for (const row of rows) {
      out.push(
        withEdgeMeta(
          {
            node: blockNodeFromRow(row[0], row[1], row[2], row[3], row[4], row[5]),
            relation,
            direction: "incoming",
          },
          row[6],
          row[7],
        ),
      );
    }
  }
  for (const relation of MEMBER_TO_BLOCK) {
    const rows = await store.exec(
      `MATCH (a:Block)-[:HAS_MEMBER]->(m:Member)-[r:${relation}]->(b:Block {fqn: $fqn})
       RETURN a.fqn, a.name, a.file, a.library, a.origin, a.resolved, r.file, r.line,
              m.id, m.name, m.file, m.origin, m.kind, m.displayFqn
       ORDER BY a.fqn, m.displayFqn`,
      { fqn },
    );
    for (const row of rows) {
      out.push(
        withEdgeMeta(
          {
            node: blockNodeFromRow(row[0], row[1], row[2], row[3], row[4], row[5]),
            relation,
            direction: "incoming",
          },
          row[6],
          row[7],
          memberNodeFromRow(row[8], row[9], row[10], row[11], row[12], row[13]),
        ),
      );
    }
  }
  return out;
}

export async function neighbors(store: GraphStore, fqn: string): Promise<GraphNeighbor[]> {
  const outgoing = await uses(store, fqn);
  const incoming = await usedBy(store, fqn);
  return [...outgoing, ...incoming];
}

export async function ancestors(
  store: GraphStore,
  fqn: string,
  depth?: number,
): Promise<GraphNode[]> {
  const max = depthOf(depth);
  const rows = await store.exec(
    `MATCH (a:Block {fqn: $fqn})-[:BASE_TYPE*1..${max}]->(b:Block)
     RETURN DISTINCT b.fqn, b.name, b.file, b.library, b.origin, b.resolved
     ORDER BY b.fqn`,
    { fqn },
  );
  return rows.map((row) => blockNodeFromRow(row[0], row[1], row[2], row[3], row[4], row[5]));
}

export async function descendants(
  store: GraphStore,
  fqn: string,
  depth?: number,
): Promise<GraphNode[]> {
  const max = depthOf(depth);
  const rows = await store.exec(
    `MATCH (a:Block)-[:BASE_TYPE*1..${max}]->(b:Block {fqn: $fqn})
     RETURN DISTINCT a.fqn, a.name, a.file, a.library, a.origin, a.resolved
     ORDER BY a.fqn`,
    { fqn },
  );
  return rows.map((row) => blockNodeFromRow(row[0], row[1], row[2], row[3], row[4], row[5]));
}

interface Hop {
  key: string;
  node: GraphNode;
  relation: GraphRelation;
  direction: "outgoing";
  file?: string;
  line?: number;
  via?: GraphNode;
}

function pushHop(
  hops: Hop[],
  key: string,
  node: GraphNode,
  relation: GraphRelation,
  file: unknown,
  line: unknown,
): void {
  const hop: Hop = { key, node, relation, direction: "outgoing" };
  const edgeFile = asString(file);
  if (edgeFile) {
    hop.file = edgeFile;
  }
  const edgeLine = optionalLine(line);
  if (edgeLine !== undefined) {
    hop.line = edgeLine;
  }
  hops.push(hop);
}

async function expandOutgoing(store: GraphStore, node: GraphNode): Promise<Hop[]> {
  const hops: Hop[] = [];
  if (node.kind === "block") {
    for (const relation of BLOCK_TO_BLOCK) {
      const outgoing = await store.exec(
        `MATCH (a:Block {fqn: $id})-[r:${relation}]->(b:Block)
         RETURN b.fqn, b.name, b.file, b.library, b.origin, b.resolved, r.file, r.line`,
        { id: node.fqn },
      );
      for (const row of outgoing) {
        pushHop(
          hops,
          `block:${asString(row[0])}`,
          blockNodeFromRow(row[0], row[1], row[2], row[3], row[4], row[5]),
          relation,
          row[6],
          row[7],
        );
      }
    }
    const toMembers = await store.exec(
      `MATCH (a:Block {fqn: $id})-[r:HAS_MEMBER]->(m:Member)
       RETURN m.id, m.name, m.file, m.origin, m.kind, m.displayFqn, r.file, r.line`,
      { id: node.fqn },
    );
    for (const row of toMembers) {
      pushHop(
        hops,
        `member:${asString(row[0])}`,
        memberNodeFromRow(row[0], row[1], row[2], row[3], row[4], row[5]),
        "HAS_MEMBER",
        row[6],
        row[7],
      );
    }
    return hops;
  }
  for (const relation of MEMBER_TO_BLOCK) {
    const outgoing = await store.exec(
      `MATCH (m:Member {id: $id})-[r:${relation}]->(b:Block)
       RETURN b.fqn, b.name, b.file, b.library, b.origin, b.resolved, r.file, r.line`,
      { id: node.fqn },
    );
    for (const row of outgoing) {
      pushHop(
        hops,
        `block:${asString(row[0])}`,
        blockNodeFromRow(row[0], row[1], row[2], row[3], row[4], row[5]),
        relation,
        row[6],
        row[7],
      );
    }
  }
  return hops;
}

export async function shortestPath(
  store: GraphStore,
  from: string,
  to: string,
  depth?: number,
): Promise<GraphPath | undefined> {
  if (from === to) {
    const node = await loadBlock(store, from);
    if (!node) {
      return undefined;
    }
    return { from: node, to: node, hops: [] };
  }
  const start = await loadBlock(store, from);
  const goal = await loadBlock(store, to);
  if (!start || !goal) {
    return undefined;
  }
  const max = depthOf(depth);
  const visited = new Set<string>([`block:${from}`]);
  const queue: Array<{ node: GraphNode; hops: GraphPathHop[] }> = [{ node: start, hops: [] }];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.hops.length >= max) {
      continue;
    }
    const nextHops = await expandOutgoing(store, current.node);
    for (const hop of nextHops) {
      if (visited.has(hop.key)) {
        continue;
      }
      visited.add(hop.key);
      const pathHop: GraphPathHop = {
        relation: hop.relation,
        direction: hop.direction,
        node: hop.node,
      };
      if (hop.file) {
        pathHop.file = hop.file;
      }
      if (hop.line !== undefined) {
        pathHop.line = hop.line;
      }
      if (hop.via) {
        pathHop.via = hop.via;
      }
      const hops = [...current.hops, pathHop];
      if (hop.node.kind === "block" && hop.node.fqn === to) {
        return { from: start, to: goal, hops };
      }
      queue.push({ node: hop.node, hops });
    }
  }
  return undefined;
}

export async function members(store: GraphStore, fqn: string): Promise<GraphMember[]> {
  const authored = await store.exec(
    `MATCH (start:Block {fqn: $fqn})-[r:HAS_MEMBER]->(m:Member)
     RETURN m.id, m.name, m.file, m.origin, m.kind, m.displayFqn, m.ownerFqn, r.file, r.line
     ORDER BY m.name`,
    { fqn },
  );
  const inherited = await store.exec(
    `MATCH (start:Block {fqn: $fqn})-[:BASE_TYPE*1..16]->(owner:Block)-[r:HAS_MEMBER]->(m:Member)
     RETURN m.id, m.name, m.file, m.origin, m.kind, m.displayFqn, m.ownerFqn, r.file, r.line
     ORDER BY m.ownerFqn, m.name`,
    { fqn },
  );
  const viaContract = await store.exec(
    `MATCH (start:Block {fqn: $fqn})-[:CONTRACT]->(owner:Block)-[r:HAS_MEMBER]->(m:Member)
     RETURN m.id, m.name, m.file, m.origin, m.kind, m.displayFqn, m.ownerFqn, r.file, r.line
     ORDER BY m.ownerFqn, m.name`,
    { fqn },
  );
  const seen = new Set<string>();
  const out: GraphMember[] = [];
  for (const row of [...authored, ...inherited, ...viaContract]) {
    const id = asString(row[0]);
    const name = asString(row[1]);
    if (!id || seen.has(id) || seen.has(`name:${name}`)) {
      continue;
    }
    seen.add(id);
    seen.add(`name:${name}`);
    const node = memberNodeFromRow(row[0], row[1], row[2], row[3], row[4], row[5]);
    const ownerFqn = asString(row[6]);
    const member: GraphMember = {
      node,
      relation: "HAS_MEMBER",
    };
    if (ownerFqn && ownerFqn !== fqn) {
      member.inheritedFrom = ownerFqn;
    }
    const file = asString(row[7]);
    if (file) {
      member.file = file;
    }
    const line = optionalLine(row[8]);
    if (line !== undefined) {
      member.line = line;
    }
    out.push(member);
  }
  return out;
}

export async function runQuery(
  store: GraphStore,
  cypher: string,
  params?: Record<string, unknown>,
): Promise<GraphQueryResult> {
  const { columns, rows } = await store.execWithColumns(cypher, params);
  return {
    columns,
    rows: rows.map((values) => ({ columns, values })),
  };
}

export { graphSchema, loadBlock };
