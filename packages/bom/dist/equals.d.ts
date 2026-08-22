import type { BomDocument } from "./types/document.js";
/**
 * Deep-clone a value tree omitting provenance keys recursively (B20).
 * Removes SourceInfo, SourceLocation-shaped spans (including typeSource /
 * baseTypeSource), and optional endLine/endColumn — but preserves
 * ImplementationBlock.source (implementation code body).
 */
export declare function stripProvenance<T>(node: T): T;
/** Structural equality modulo provenance (B20). */
export declare function bomEquals(a: BomDocument, b: BomDocument): boolean;
//# sourceMappingURL=equals.d.ts.map