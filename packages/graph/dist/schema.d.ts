import type { GraphRelation, GraphSchema } from "./types.js";
export declare const GRAPH_NODE_TABLES: readonly ["Block", "Member"];
export declare const GRAPH_RELATIONS: GraphRelation[];
export declare const GRAPH_SCHEMA_DDL: string[];
export declare const GRAPH_SCHEMA_DESCRIPTION: string;
export declare const GRAPH_CYPHER_EXAMPLE = "MATCH (a:Block {fqn: $fqn})-[:BASE_TYPE]->(b:Block) RETURN b.fqn";
export declare function graphSchema(): GraphSchema;
//# sourceMappingURL=schema.d.ts.map