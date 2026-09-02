export interface CreateBlockOptions {
  /** Root block FQN. */
  type: string;
  /** Short class name. Defaults to the last FQN segment. */
  name?: string;
  /** Parent type FQN. Defaults to org.blockml.bml.core.Block. */
  baseType?: string;
  /** Idea (Urbild) prose. Defaults to name. */
  is?: string;
  /** Optional documentation prose. */
  documentation?: string;
  /** SourceInfo.filePath. */
  filePath?: string;
}

export interface AddPropertyOptions {
  name: string;
  typeFqn: string;
  value?: string;
}

export interface AddAggregationOptions {
  name: string;
  typeFqn: string;
}
