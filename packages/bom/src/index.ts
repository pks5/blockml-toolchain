export type {
  SourceLocation,
  SourceInfo,
  XmlTrivia,
  MemberSectionName,
  MetadataElementTrivia,
  XmlNodeKind,
  CharacterDataForm,
  XmlRenderingBlock,
  XmlRenderingMember,
  DiagnosticSeverity,
  Diagnostic,
} from "./types/common.js";

export type { BomDocument } from "./types/document.js";

export type {
  TypeReferenceEntityInstance,
  GenericType,
  BlockDefinition,
  KeywordEntry,
  DocumentationProseEntry,
  AliasEntry,
  ChangelogEntry,
  DocumentationExample,
  DocumentationReference,
} from "./types/block-definition.js";

export type {
  TypeExpression,
  TypeDescriptor,
  Multiplicity,
  InstanceConfiguration,
  NamedTypeReference,
  UnionTypeExpression,
  GroupedTypeExpression,
  GenericParameterReference,
  SelfTypeReference,
  AnonymousStructType,
  StructField,
} from "./types/type-expression.js";

export type {
  MemberDefinition,
  ConstrainableDefinition,
  MemberDefinitionBase,
  PropertyDefinition,
  PropertyValueEntry,
  AggregationDefinition,
  AssociationDefinition,
  CapabilityDefinition,
  ImplementationBlock,
  EmbeddedExpression,
} from "./types/member-definition.js";

export type {
  CompositionTemplate,
  InstanceAggregationComposition,
  CompositionNode,
  BlockInstanceNode,
  VirtualContainerNode,
  BlockInstance,
  DirectiveAttribute,
  EachDirective,
  IfDirective,
  UnlessDirective,
  WithDirective,
  WithBinding,
} from "./types/composition.js";

export type {
  MemberValue,
  LiteralValue,
  ExpressionValue,
  AddressValue,
  Address,
} from "./types/values.js";

export type {
  ParseResult,
  SerializeResult,
  ParseOptions,
  SerializeOptions,
  ValidateResult,
  ValidateOptions,
  TypeRegistryReader,
} from "./types/api.js";

export { bomEquals, stripProvenance } from "./equals.js";
