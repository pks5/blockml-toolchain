import type { GraphRelation, GraphSchema } from "./types.js";

export const GRAPH_NODE_TABLES = ["Block", "Member"] as const;

export const GRAPH_RELATIONS: GraphRelation[] = [
  "BASE_TYPE",
  "CONTRACT",
  "HAS_SUBBLOCK",
  "HAS_MEMBER",
  "MEMBER_TYPE",
  "INPUT_TYPE",
  "OUTPUT_TYPE",
  "THROWS",
];

export const GRAPH_SCHEMA_DDL = [
  "CREATE NODE TABLE Block(fqn STRING, name STRING, file STRING, library STRING, origin STRING, resolved BOOLEAN, abstract BOOLEAN, PRIMARY KEY (fqn))",
  "CREATE NODE TABLE Member(id STRING, ownerFqn STRING, name STRING, kind STRING, displayFqn STRING, file STRING, line INT64, origin STRING, PRIMARY KEY (id))",
  "CREATE REL TABLE BASE_TYPE(FROM Block TO Block, file STRING, line INT64)",
  "CREATE REL TABLE CONTRACT(FROM Block TO Block, file STRING, line INT64)",
  "CREATE REL TABLE HAS_SUBBLOCK(FROM Block TO Block, file STRING, line INT64)",
  "CREATE REL TABLE HAS_MEMBER(FROM Block TO Member, file STRING, line INT64)",
  "CREATE REL TABLE MEMBER_TYPE(FROM Member TO Block, file STRING, line INT64, cardinality STRING)",
  "CREATE REL TABLE INPUT_TYPE(FROM Member TO Block, file STRING, line INT64)",
  "CREATE REL TABLE OUTPUT_TYPE(FROM Member TO Block, file STRING, line INT64)",
  "CREATE REL TABLE THROWS(FROM Member TO Block, file STRING, line INT64)",
];

export const GRAPH_SCHEMA_DESCRIPTION = [
  "Authored BlockML definition graph. Nodes: Block (type FQN), Member (ownerFqn#kind:name).",
  "Relations: BASE_TYPE, CONTRACT, HAS_SUBBLOCK, HAS_MEMBER, MEMBER_TYPE, INPUT_TYPE, OUTPUT_TYPE, THROWS.",
  "Only authored edges are stored. Transitive relations are computed by traversals.",
  "path follows outgoing authored edges only (the same direction as uses).",
  "Block.origin is workspace | dependency | unresolved. Stub Blocks have resolved=false.",
].join(" ");

export function graphSchema(): GraphSchema {
  return {
    nodes: [...GRAPH_NODE_TABLES],
    relations: [...GRAPH_RELATIONS],
    description: GRAPH_SCHEMA_DESCRIPTION,
  };
}
