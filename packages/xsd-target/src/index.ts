export { XsdTarget, type XsdRenderOutput } from "./xsd-target.js";
export { type XsdOptions, resolveXsdOptions, DEFAULT_XSD_OPTIONS } from "./options.js";
export { emitBlockXsd } from "./emit-block-xsd.js";
export { emitTypesXsd } from "./emit-types-xsd.js";
export { emitServiceXsd } from "./emit-service-xsd.js";
export {
  emitCatalogXml,
  catalogRelativePath,
  type CatalogEntry,
} from "./emit-catalog-xml.js";
export {
  BML_DOCUMENT_NS,
  BML_TYPES_NS,
  BML_SERVICE_NS,
  TYPE_FQN_PREFIX,
  SERVICE_FQN_PREFIX,
} from "./constants.js";
