import { describe, expect, it } from "vitest";
import { BML_DOCUMENT_NS, BML_SERVICE_NS, BML_TYPES_NS } from "../src/constants.js";
import { catalogRelativePath, emitCatalogXml } from "../src/emit-catalog-xml.js";

describe("emitCatalogXml", () => {
  it("maps namespace URIs to relative schema paths", () => {
    const xml = emitCatalogXml([
      {
        namespaceUri: BML_DOCUMENT_NS,
        relativePath: "./schemas/bml.xsd",
      },
      {
        namespaceUri: BML_TYPES_NS,
        relativePath: "./schemas/types.xsd",
      },
      {
        namespaceUri: BML_SERVICE_NS,
        relativePath: "./schemas/service.xsd",
      },
    ]);

    expect(xml).toContain('xmlns="urn:oasis:names:tc:entity:xmlns:xml:catalog"');
    expect(xml).toContain(`name="${BML_DOCUMENT_NS}"`);
    expect(xml).toContain('uri="./schemas/bml.xsd"');
    expect(xml).toContain(`name="${BML_TYPES_NS}"`);
    expect(xml).toContain('uri="./schemas/types.xsd"');
    expect(xml).toContain(`name="${BML_SERVICE_NS}"`);
    expect(xml).toContain('uri="./schemas/service.xsd"');
  });
});

describe("catalogRelativePath", () => {
  it("builds paths relative to project root from outDir", () => {
    expect(catalogRelativePath("schemas", "bml.xsd")).toBe("./schemas/bml.xsd");
    expect(catalogRelativePath("custom/schemas", "types.xsd")).toBe(
      "./custom/schemas/types.xsd",
    );
  });
});
