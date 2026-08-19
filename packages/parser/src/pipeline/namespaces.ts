import type { SourceInfo } from "@blockml/bom";
import type { Element } from "@xmldom/xmldom";
import { BML_XMLNS, XSI_NS } from "../util/qname.js";

export function extractNamespaceBindings(element: Element): SourceInfo {
  const info: SourceInfo = {
    filePath: "",
    format: "xml",
    namespaceBindings: {},
  };

  if (element.attributes) {
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes.item(i)!;
      const name = attr.name;
      const value = attr.value;
      if (name === "xmlns") {
        info.namespaceBindings![""] = value;
        continue;
      }
      if (name.startsWith("xmlns:")) {
        const prefix = name.slice(6);
        info.namespaceBindings![prefix] = value;
        continue;
      }
      if (name === "xsi:schemaLocation") {
        info.schemaLocation = value;
        continue;
      }
      if (name === "xsi:noNamespaceSchemaLocation") {
        info.noNamespaceSchemaLocation = value;
        continue;
      }
    }
  }

  if (!info.namespaceBindings![""]) {
    info.namespaceBindings![""] = BML_XMLNS;
  }

  return info;
}

export function mergeSourceInfo(
  partial: SourceInfo,
  filePath: string,
): SourceInfo {
  return {
    ...partial,
    filePath,
    format: "xml",
  };
}

export { XSI_NS, BML_XMLNS };
