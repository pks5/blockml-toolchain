import type { TypeRegistry } from "@blockml/framework";
import { BML_TYPES_NS, TYPE_FQN_PREFIX } from "./constants.js";

function shortName(fqn: string): string {
  const idx = fqn.lastIndexOf(".");
  return idx >= 0 ? fqn.slice(idx + 1) : fqn;
}

function vocabularyElements(registry: TypeRegistry, prefix: string): string[] {
  return registry
    .keys()
    .filter((fqn) => fqn.startsWith(prefix))
    .map(shortName)
    .sort();
}

export function emitTypesXsd(registry: TypeRegistry): string {
  const elements = vocabularyElements(registry, TYPE_FQN_PREFIX);
  const decls = elements
    .map((name) => `  <xs:element name="${name}" type="xs:string"/>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  targetNamespace="${BML_TYPES_NS}"
  xmlns="${BML_TYPES_NS}"
  elementFormDefault="qualified"
  attributeFormDefault="unqualified">

  <xs:annotation>
    <xs:documentation>Generated vocabulary for ${TYPE_FQN_PREFIX}*</xs:documentation>
  </xs:annotation>
${decls}

</xs:schema>
`;
}
