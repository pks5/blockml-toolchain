import type { Diagnostic, ParseValueHook, ResolveMemberTypeHook } from "@blockml/bom";

export interface MapContext {
  filePath: string;
  source: string;
  bindings: Record<string, string>;
  subBlockIndex: Map<string, string>;
  parentBlockType?: string;
  isRoot: boolean;
  isEmbedded: boolean;
  diagnostics: Diagnostic[];
  parseValue?: ParseValueHook;
  /** Instance member local name → declared property type. Absent → block FQN. */
  resolveMemberType?: ResolveMemberTypeHook;
  /** Domain PrimitiveEntity payloads beyond the Core well-known comma-sugar set. */
  isCommaSugarPayload?: (fqn: string) => boolean;
}

export function createMapContext(
  filePath: string,
  source: string,
  bindings: Record<string, string>,
  options: {
    subBlockIndex?: Map<string, string>;
    parentBlockType?: string;
    isRoot?: boolean;
    isEmbedded?: boolean;
    diagnostics?: Diagnostic[];
    parseValue?: ParseValueHook;
    resolveMemberType?: ResolveMemberTypeHook;
    isCommaSugarPayload?: (fqn: string) => boolean;
  } = {},
): MapContext {
  const ctx: MapContext = {
    filePath,
    source,
    bindings,
    subBlockIndex: options.subBlockIndex ?? new Map(),
    isRoot: options.isRoot ?? false,
    isEmbedded: options.isEmbedded ?? false,
    diagnostics: options.diagnostics ?? [],
  };
  if (options.parentBlockType !== undefined) {
    ctx.parentBlockType = options.parentBlockType;
  }
  if (options.parseValue !== undefined) {
    ctx.parseValue = options.parseValue;
  }
  if (options.resolveMemberType !== undefined) {
    ctx.resolveMemberType = options.resolveMemberType;
  }
  if (options.isCommaSugarPayload !== undefined) {
    ctx.isCommaSugarPayload = options.isCommaSugarPayload;
  }
  return ctx;
}
