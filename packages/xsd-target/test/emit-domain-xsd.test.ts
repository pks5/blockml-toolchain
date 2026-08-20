import { join } from "node:path";
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TypeRegistry, bootstrapTypeRegistry } from "@blockml/framework";
import { BML_SERVICE_NS, BML_TYPES_NS } from "../src/constants.js";
import { emitServiceXsd } from "../src/emit-service-xsd.js";
import { emitTypesXsd } from "../src/emit-types-xsd.js";

const ROOT = join(import.meta.dirname, "..", "..", "..");
const CORE_LIBRARY = join(
  ROOT,
  "node_modules/@blockml/core/blocks/org/blockml/bml/Library.bml",
);

describe("emitTypesXsd", () => {
  it("emits vocabulary elements for org.blockml.bml.type.* from registry", () => {
    if (!existsSync(CORE_LIBRARY)) {
      throw new Error(`Missing fixture: ${CORE_LIBRARY}`);
    }

    const bootstrap = bootstrapTypeRegistry({
      libraryPaths: [CORE_LIBRARY],
      rootDir: ROOT,
    });

    const xml = emitTypesXsd(bootstrap.registry);
    expect(xml).toContain(`targetNamespace="${BML_TYPES_NS}"`);
    expect(xml).toContain('<xs:element name="Boolean"');
    expect(xml).toContain('<xs:element name="TypeReference"');
  });

  it("emits an empty schema when registry has no type FQNs", () => {
    const xml = emitTypesXsd(new TypeRegistry());
    expect(xml).toContain(`targetNamespace="${BML_TYPES_NS}"`);
    expect(xml).not.toContain("<xs:element name=");
  });
});

describe("emitServiceXsd", () => {
  it("emits vocabulary elements for org.blockml.bml.service.* from registry", () => {
    if (!existsSync(CORE_LIBRARY)) {
      throw new Error(`Missing fixture: ${CORE_LIBRARY}`);
    }

    const bootstrap = bootstrapTypeRegistry({
      libraryPaths: [CORE_LIBRARY],
      rootDir: ROOT,
    });

    const xml = emitServiceXsd(bootstrap.registry);
    expect(xml).toContain(`targetNamespace="${BML_SERVICE_NS}"`);
    expect(xml).toContain('<xs:element name="Math"');
    expect(xml).toContain('<xs:element name="Strings"');
  });

  it("emits an empty schema when registry has no service FQNs", () => {
    const xml = emitServiceXsd(new TypeRegistry());
    expect(xml).toContain(`targetNamespace="${BML_SERVICE_NS}"`);
    expect(xml).not.toContain("<xs:element name=");
  });
});
