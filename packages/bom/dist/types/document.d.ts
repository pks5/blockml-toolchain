import type { SourceInfo } from "./common.js";
import type { BlockDefinition } from "./block-definition.js";
/** Every parsed or Builder-sealed BML document is exactly one BomDocument (Urmodell). */
export interface BomDocument {
    /** V1: always `<block>` root. */
    kind: "block";
    /** Parse metadata. */
    source: SourceInfo;
    /** Root block definition. */
    block: BlockDefinition;
}
//# sourceMappingURL=document.d.ts.map