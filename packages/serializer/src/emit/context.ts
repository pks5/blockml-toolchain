import { hasBmlSemanticQNameBindings } from "./qname.js";

export interface EmitContext {
  bindings: Record<string, string>;
  useQName: boolean;
  indent: number;
}

export function createEmitContext(
  bindings: Record<string, string>,
  indent: number,
): EmitContext {
  return {
    bindings,
    useQName: hasBmlSemanticQNameBindings(bindings),
    indent,
  };
}
