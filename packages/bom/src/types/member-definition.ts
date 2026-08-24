import type {
  CharacterDataForm,
  SourceLocation,
  XmlRenderingMember,
  XmlTrivia,
} from "./common.js";
import type { BlockInstance } from "./composition.js";
import type {
  AliasEntry,
  ChangelogEntry,
  DocumentationExample,
  DocumentationProseEntry,
  DocumentationReference,
  KeywordEntry,
  TypeReferenceEntityInstance,
} from "./block-definition.js";
import type { TypeDescriptor, TypeExpression } from "./type-expression.js";
import type { MemberValue } from "./values.js";
import type { CompositionTemplate } from "./composition.js";

export type MemberDefinition =
  | PropertyDefinition
  | AggregationDefinition
  | AssociationDefinition
  | CapabilityDefinition;

export interface ConstrainableDefinition {
  constraints?: BlockInstance[];
}

export interface MemberDefinitionBase {
  /** Logical member name — visibility prefixes `_` / `__` stripped (B14). */
  name: string;
  summaries?: DocumentationProseEntry[];
  keywords?: KeywordEntry[];
  documentations?: DocumentationProseEntry[];
  since?: string;
  changelog?: ChangelogEntry[];
  examples?: DocumentationExample[];
  references?: DocumentationReference[];
  /** Resolved canonical namespace identifier (FQN or URI). */
  namespace?: string;
  visibility?: "private" | "protected" | "public";
  readOnly?: boolean;
  abstract?: boolean;
  final?: boolean;
  override?: boolean;
  xmlRendering?: XmlRenderingMember;
  constraints?: BlockInstance[];
  xmlTrivia?: XmlTrivia;
  source?: SourceLocation;
  /** Source span of the authored `type` attribute value when present. */
  typeSource?: SourceLocation;
}

export interface PropertyDefinition extends MemberDefinitionBase {
  kind: "property";
  /** Resolved type FQN for simple property types. */
  typeFqn: string;
  /** Full parse-time type expression when authored form is not a plain FQN (e.g. TypeReference(core:Block)). */
  type?: TypeExpression;
  values?: PropertyValueEntry[];
  /** Convenience — default-namespace entry from values[]. */
  value?: MemberValue;
  group?: string;
  /** Block instances of the same type as typeFqn — metadata only. */
  suggestions?: BlockInstance[];
  /** Member group TypeReferenceEntity instances (Property-only). */
  groups?: TypeReferenceEntityInstance[];
}

export interface PropertyValueEntry {
  /** "" = canonical value; else resolved Annotation FQN. */
  namespace: string;
  value: MemberValue;
}

export interface AggregationDefinition extends MemberDefinitionBase {
  kind: "aggregation";
  /** Full TypeExpression — plain Block[] or TypeReferenceEntity(T)[]. Omitted when not authored. */
  type?: TypeExpression;
  /** Omitted when not authored (inherited aggregation fill sites). */
  cardinality?: "0..1" | "0..n" | "1..1" | "1..n";
  default?: boolean;
  /** Nested composition filling this aggregation — instance aggregations only. */
  composition?: CompositionTemplate;
  /** Member group TypeReferenceEntity instances. */
  groups?: TypeReferenceEntityInstance[];
  /** false when authored as direct block child (not inside `<aggregations>`). */
  authoredInAggregationsSection?: boolean;
}

export interface AssociationDefinition extends MemberDefinitionBase {
  kind: "association";
  type: TypeExpression;
  cardinality: "0..1" | "0..n";
}

export interface CapabilityDefinition extends MemberDefinitionBase {
  kind: "capability";
  typeFqn: string;
  inputType?: TypeDescriptor;
  outputType?: TypeDescriptor;
  /** Source span of the authored `inputType` attribute value. */
  inputTypeSource?: SourceLocation;
  /** Source span of the authored `outputType` attribute value. */
  outputTypeSource?: SourceLocation;
  implementation?: ImplementationBlock;
}

export interface ImplementationBlock {
  languageFqn: string;
  /** Host-element character data — full original text including <$ $> regions. */
  source: string;
  authoredCharacterDataForm?: CharacterDataForm;
  /** Embedded expression regions — defaults to [] when omitted. */
  embeddedExpressions?: EmbeddedExpression[];
  sourceLocation?: SourceLocation;
}

export interface EmbeddedExpression {
  /** Expression text between delimiters (for later parseExpression). */
  raw: string;
  /** Byte/char offset of opening <$ in source. */
  start: number;
  /** Offset immediately after closing $>. */
  end: number;
}
