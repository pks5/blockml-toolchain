import type { MemberValue, ExpressionValue } from "./values.js";
import type { SourceLocation, XmlTrivia } from "./common.js";

/** Target aggregation name — e.g. "_parts", "blocks", "_presets". */
export interface CompositionTemplate {
  aggregationName: string;
  directives?: DirectiveAttribute[];
  children: CompositionNode[];
  source?: SourceLocation;
}

/** Aggregation opened inline on a Block instance. */
export interface InstanceAggregationComposition {
  aggregationName: string;
  composition: CompositionTemplate;
}

export type CompositionNode = BlockInstanceNode | VirtualContainerNode;

export interface BlockInstanceNode {
  kind: "blockInstance";
  instance: BlockInstance;
  /** bml:each, bml:if, bml:unless, bml:with on this block instance element. */
  directives?: DirectiveAttribute[];
  source?: SourceLocation;
}

export interface VirtualContainerNode {
  kind: "virtualContainer";
  /** bml:each, bml:if, bml:unless, bml:with on `<bml:container>`. */
  directives?: DirectiveAttribute[];
  children: CompositionNode[];
  source?: SourceLocation;
}

/** Represents a concrete child block in a composition. */
export interface BlockInstance {
  /** Resolved FQN of the referenced block type. */
  typeFqn: string;
  /** Composition instance identity — from bml:id (literal or ExpressionValue). */
  id?: MemberValue;
  /** From bml:version — optional exact-version assert on external block references. */
  version?: MemberValue;
  /** From bml:bean — registers this instance as a named service bean. */
  bean?: MemberValue;
  /** From bml:scope — bean visibility: "local" (default) or "context". */
  scope?: "local" | "context";
  /** Preset reference: {PresetsDocumentFQN}::{preset-id}. */
  basePresets?: string;
  renderGroup?: string;
  namespace?: string;
  /** Member values set on this instance (properties + capabilities). */
  memberValues: Record<string, MemberValue>;
  /** Nested aggregation compositions on this instance. */
  aggregationCompositions?: InstanceAggregationComposition[];
  /** XML comments bound to this composition instance element (B11). */
  xmlTrivia?: XmlTrivia;
  source?: SourceLocation;
  /** Unknown bml:* attributes preserved for roundtrip. */
  unknownAttributes?: Record<string, string>;
}

export type DirectiveAttribute =
  | EachDirective
  | IfDirective
  | UnlessDirective
  | WithDirective;

export interface EachDirective {
  type: "each";
  variables: string[];
  statVariable?: string;
  collection: ExpressionValue;
}

export interface IfDirective {
  type: "if";
  condition: ExpressionValue;
}

export interface UnlessDirective {
  type: "unless";
  condition: ExpressionValue;
}

export interface WithDirective {
  type: "with";
  bindings: WithBinding[];
}

export interface WithBinding {
  name: string;
  value: ExpressionValue;
}
