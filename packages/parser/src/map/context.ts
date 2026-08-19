export interface MapContext {
  filePath: string;
  source: string;
  bindings: Record<string, string>;
  subBlockIndex: Map<string, string>;
  parentBlockType?: string;
  isRoot: boolean;
  isEmbedded: boolean;
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
  } = {},
): MapContext {
  const ctx: MapContext = {
    filePath,
    source,
    bindings,
    subBlockIndex: options.subBlockIndex ?? new Map(),
    isRoot: options.isRoot ?? false,
    isEmbedded: options.isEmbedded ?? false,
  };
  if (options.parentBlockType !== undefined) {
    ctx.parentBlockType = options.parentBlockType;
  }
  return ctx;
}
