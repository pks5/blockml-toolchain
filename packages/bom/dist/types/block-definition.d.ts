import type { CharacterDataForm, EmptyElementForm, MetadataElementTrivia, MemberSectionName, SourceLocation, UnknownXmlNode, XmlRenderingBlock, XmlTrivia } from "./common.js";
import type { BlockInstance, GenericsBinding } from "./composition.js";
import type { MemberDefinition } from "./member-definition.js";
import type { CompositionTemplate } from "./composition.js";
import type { TypeExpression } from "./type-expression.js";
/** BOM shape for org.blockml.bml.type.TypeReferenceEntity(B[, D]) instances. */
export interface TypeReferenceEntityInstance {
    typeFqn: "org.blockml.bml.type.TypeReferenceEntity";
    /** Authored / resolved TypeReference (FQN or TypeExpression). */
    value: string;
    /** Bound B from the aggregation type application (when recorded). */
    boundB?: string;
}
export interface GenericType {
    /** Parameter name (e.g. T). */
    name: string;
    /** FQN constraint — each concrete type argument must satisfy this bound. */
    baseType: string;
    /**
     * Optional default when a generic application omits this argument.
     * Concrete TypeExpression, or the name of an earlier sibling generic parameter.
     */
    defaultType?: string;
}
export interface BlockDefinition {
    /** Short class name (PascalCase). Required. */
    name: string;
    /**
     * Globally unique FQN.
     * Required on root blocks (authored in BML).
     * Derived on Sub-Blocks: parentFqn + "." + name
     */
    type: string;
    /**
     * Authored definition wrapper (doc:DocumentFormat).
     * `"block"` = legacy `<block>`; `"type"` = type-or-name tag.
     * Omitted on hand-built BOM defaults to `"block"` on serialize.
     */
    wrapperForm?: "block" | "type";
    /** Parent type FQN. Omitted in some corpus files. */
    baseType?: string;
    /**
     * Full authored baseType expression when it is not a plain FQN
     * (generic arguments, instance configuration, multiplicity).
     */
    baseTypeExpression?: TypeExpression;
    /** Semantic version of this definition. Omitted when inherited from Library. */
    version?: string;
    /** Required: names the Idea (Urbild). */
    is?: string;
    /** Short prose expansions (i18n + optional QName facets). */
    summaries?: DocumentationProseEntry[];
    /** Optional search/discovery tags — core.Keyword Entity instances. */
    keywords?: KeywordEntry[];
    /** Natural language for documentation prose — TypeReferenceEntity instance. */
    language?: TypeReferenceEntityInstance;
    /** Resolved FQN projection of language.value. */
    languageFqn?: string;
    /** Technical prose entries (i18n + optional QName facets). */
    documentations?: DocumentationProseEntry[];
    /** What this Block is not — required when confusion risk exists. */
    isNot?: string;
    /** Alternative names for this Block type — core.Alias Entity instances. */
    aliases?: AliasEntry[];
    /** Semantic version from which this definition is available. */
    since?: string;
    /** Version history entries — oldest first. */
    changelog?: ChangelogEntry[];
    /** Usage examples with character-data body. */
    examples?: DocumentationExample[];
    /** Cross-references to related Blocks or Definitions. */
    references?: DocumentationReference[];
    /** Abstract type — not usable as composition instance type. Default false. */
    abstract?: boolean;
    /** Final type — cannot be used as baseType on definitions. Default false. */
    final?: boolean;
    /** Authored block-level `<bml:xml>…</bml:xml>`. */
    xmlRendering?: XmlRenderingBlock;
    /** Misplaced `bml:generics` on a Block definition (or member section). */
    generics?: GenericsBinding;
    /** BlockML access visibility — Sub-Blocks only. */
    visibility?: "private" | "protected" | "public";
    /** Contract TypeReferenceEntity instances merged into this Block. Root block only. */
    contracts?: TypeReferenceEntityInstance[];
    /** Generic type parameters declared on this Block. */
    genericTypes?: GenericType[];
    /** Definition meta-model type FQN for this block's definition document. */
    definitionFqn?: string;
    /** Constraint Block instances on this Block definition. */
    constraints?: BlockInstance[];
    /**
     * Members declared in THIS block only — not inherited.
     * Array order is significant.
     */
    members: MemberDefinition[];
    /** Sub-Block definitions nested under this block. */
    subBlocks: BlockDefinition[];
    /**
     * Inline Library — virtual .bml files on the document root only.
     * Each entry is EmbeddedBlockDefinition.
     */
    embeddedBlocks: BlockDefinition[];
    /** Composition templates — derived from nested composition inside aggregation members. */
    compositions: CompositionTemplate[];
    /** XML comments on this definition element itself (B11). */
    xmlTrivia?: XmlTrivia;
    /** Comments bound to flattened member-section containers. */
    memberSectionTrivia?: Partial<Record<MemberSectionName, XmlTrivia>>;
    /** Comments bound to metadata child elements that map to fields. */
    metadataTrivia?: MetadataElementTrivia;
    /** BML source span of this definition (root or sub-block). */
    source?: SourceLocation;
    /** Source span of the `<type>` metadata element. */
    typeSource?: SourceLocation;
    /** Source span of the `<baseType>` metadata element. */
    baseTypeSource?: SourceLocation;
    /** Preserve-on-error unknown root children. */
    unknownElements?: UnknownXmlNode[];
    /** Unknown attributes on the &lt;block&gt; grammar node. */
    unknownAttributes?: Record<string, string>;
}
export interface KeywordEntry {
    typeFqn: string;
    term?: string;
    languageFqn?: string;
    weight?: number;
    source?: SourceLocation;
}
export interface DocumentationProseEntry {
    namespace: string;
    text: string;
    languageFqn: string;
    authoredCharacterDataForm?: CharacterDataForm;
    source?: SourceLocation;
}
export interface AliasEntry {
    typeFqn: string;
    name?: string;
    languageFqn?: string;
    legacy?: boolean;
    source?: SourceLocation;
}
export interface ChangelogEntry {
    version: string;
    text: string;
    languageFqn?: string;
    source?: SourceLocation;
}
export interface DocumentationExample {
    title: string;
    content: string;
    authoredCharacterDataForm?: CharacterDataForm;
    contentLanguageFqn?: string;
    snippet?: boolean;
    namespace?: string;
    source?: SourceLocation;
}
export interface DocumentationReference {
    type?: string;
    instance?: string;
    file?: string;
    url?: string;
    property?: string;
    aggregation?: string;
    association?: string;
    capability?: string;
    relationFqn?: string;
    context: string;
    languageFqn?: string;
    authoredEmptyElementForm?: EmptyElementForm;
    source?: SourceLocation;
}
//# sourceMappingURL=block-definition.d.ts.map