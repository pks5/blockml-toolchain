export interface XsdOptions {
  /** when false, only Library.blocks exports inform extra particles; unused for V1 emit */
  includeNonExported?: boolean;
}

export const DEFAULT_XSD_OPTIONS: Required<XsdOptions> = {
  includeNonExported: true,
};

export function resolveXsdOptions(targetOptions?: unknown): Required<XsdOptions> {
  const opts = (targetOptions ?? {}) as XsdOptions;
  return {
    includeNonExported:
      opts.includeNonExported ?? DEFAULT_XSD_OPTIONS.includeNonExported,
  };
}
