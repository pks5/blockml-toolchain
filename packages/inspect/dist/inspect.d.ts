import { type TypeRegistry } from "@blockml/framework";
import { type InspectBlockOptions, type InspectProjectOptions, type InspectResult } from "./types.js";
export declare function isLeafTypeFqn(fqn: string): boolean;
export declare function inspectBlock(fqn: string, registry: TypeRegistry, options?: InspectBlockOptions): InspectResult;
export declare function inspectProject(fqn: string, options?: InspectProjectOptions): InspectResult;
//# sourceMappingURL=inspect.d.ts.map