import { BML_DOCUMENT_NS } from "./constants.js";
/** D1 definition-document identity / prose particles. */
const D1_IDENTITY_ELEMENTS = [
    "name",
    "type",
    "baseType",
    "is",
    "isNot",
    "isnot",
    "version",
    "summary",
    "documentation",
    "abstract",
    "final",
    "since",
    "status",
    "language",
    "keywords",
    "aliases",
];
/** D1 aggregation / structured containers. */
const D1_CONTAINER_ELEMENTS = [
    "properties",
    "aggregations",
    "associations",
    "capabilities",
    "subBlocks",
    "embeddedBlocks",
    "references",
    "examples",
    "changelog",
    "constraints",
    "suggestions",
    "composition",
    "implementation",
    "groups",
    "contracts",
    "genericTypes",
];
const META_DEFINITION_FQNS = [
    "org.blockml.bml.definition.BlockDefinition",
    "org.blockml.bml.definition.StructuralDefinition",
    "org.blockml.bml.definition.MemberDefinition",
    "org.blockml.bml.definition.RootBlockDefinition",
];
function memberPrefersElement(member) {
    const rendering = member.xmlRendering;
    if (rendering?.kinds?.includes("element")) {
        return true;
    }
    if (rendering?.raw?.includes("element")) {
        return true;
    }
    if (rendering?.kinds?.length === 1 && rendering.kinds[0] === "attribute") {
        return false;
    }
    if (rendering?.raw === "attribute") {
        return false;
    }
    if (member.kind === "aggregation" || member.kind === "association") {
        return true;
    }
    return true;
}
function extraElementNamesFromBlock(block) {
    const names = [];
    for (const member of block.members) {
        if (memberPrefersElement(member)) {
            names.push(member.name);
        }
    }
    for (const sub of block.subBlocks) {
        names.push(...extraElementNamesFromBlock(sub));
    }
    return names;
}
function extraElementNames(registry) {
    const names = [];
    for (const fqn of META_DEFINITION_FQNS) {
        const doc = registry.get(fqn);
        if (doc) {
            names.push(...extraElementNamesFromBlock(doc.block));
        }
    }
    return names;
}
function uniqueSorted(values) {
    return [...new Set(values)].sort();
}
function elementDecl(name) {
    return `      <xs:element name="${name}" minOccurs="0" maxOccurs="unbounded"/>`;
}
export function emitBlockXsd(registry) {
    const identity = uniqueSorted(D1_IDENTITY_ELEMENTS);
    const containers = uniqueSorted(D1_CONTAINER_ELEMENTS);
    const extras = extraElementNames(registry).filter((name) => !identity.includes(name) && !containers.includes(name));
    const children = [
        ...identity.map(elementDecl),
        ...containers.map(elementDecl),
        ...extras.map(elementDecl),
    ].join("\n");
    return `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  targetNamespace="${BML_DOCUMENT_NS}"
  xmlns="${BML_DOCUMENT_NS}"
  elementFormDefault="qualified"
  attributeFormDefault="unqualified">

  <xs:element name="block">
    <xs:complexType mixed="true">
      <xs:choice minOccurs="0" maxOccurs="unbounded">
${children}
      </xs:choice>
      <xs:anyAttribute processContents="lax"/>
    </xs:complexType>
  </xs:element>

</xs:schema>
`;
}
//# sourceMappingURL=emit-block-xsd.js.map