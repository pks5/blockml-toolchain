import type { BomDocument, Diagnostic } from "@blockml/bom";
import type { TypeRegistry } from "@blockml/framework";
import type { CompileInput, CompileOptions, CompilerResult } from "./types.js";
export declare function compileBmlToBom(input: CompileInput, options?: CompileOptions): CompilerResult<BomDocument>;
export declare function validateRegistryDocuments(registry: TypeRegistry): Diagnostic[];
//# sourceMappingURL=compile-bml-to-bom.d.ts.map