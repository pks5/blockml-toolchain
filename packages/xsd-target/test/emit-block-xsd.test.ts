import { describe, expect, it } from "vitest";
import { TypeRegistry } from "@blockml/framework";
import { emitBlockXsd } from "../src/emit-block-xsd.js";

describe("emitBlockXsd", () => {
  it("emits a universal block schema with D1 particles and no element wildcard", () => {
    const xml = emitBlockXsd(new TypeRegistry());
    expect(xml).toContain('<xs:schema');
    expect(xml).toContain('targetNamespace="http://blockml.org/bml"');
    expect(xml).toContain('<xs:element name="block">');
    expect(xml).toContain('<xs:element name="name"');
    expect(xml).toContain('<xs:element name="type"');
    expect(xml).toContain('<xs:element name="baseType"');
    expect(xml).toContain('<xs:element name="properties"');
    expect(xml).toContain('<xs:element name="aggregations"');
    expect(xml).not.toContain("<xs:any ");
    expect(xml).toContain("<xs:anyAttribute");
  });
});
