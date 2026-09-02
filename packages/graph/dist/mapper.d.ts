import { type TypeRegistry } from "@blockml/framework";
import type { GraphOrigin, GraphRelation, MemberKind } from "./types.js";
export interface MappedBlock {
    fqn: string;
    name: string;
    file: string;
    library: string;
    origin: GraphOrigin;
    resolved: boolean;
    abstract: boolean;
}
export interface MappedMember {
    id: string;
    ownerFqn: string;
    name: string;
    kind: MemberKind;
    displayFqn: string;
    file: string;
    line: number;
    origin: GraphOrigin;
}
export interface MappedEdge {
    relation: GraphRelation;
    from: string;
    to: string;
    file: string;
    line: number;
    cardinality: string;
}
export interface GraphData {
    blocks: MappedBlock[];
    members: MappedMember[];
    edges: MappedEdge[];
    filePaths: string[];
}
export declare function graphDataFromRegistry(registry: TypeRegistry, options?: {
    rootDir?: string;
    srcDir?: string;
}): GraphData;
//# sourceMappingURL=mapper.d.ts.map