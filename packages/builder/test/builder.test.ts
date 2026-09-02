import { describe, expect, it } from "vitest";
import { parse } from "@blockml/parser";
import { serialize } from "@blockml/serializer";
import { BomBuilder } from "../src/index.js";

describe("BomBuilder", () => {
  it("create → seal → serialize → parse roundtrips identity and a property", () => {
    const sealed = BomBuilder.create({
      type: "com.example.widget.Face",
      baseType: "org.blockml.bml.core.Block",
      is: "A demo face",
      documentation: "Roundtrip fixture",
    })
      .addProperty({
        name: "width",
        typeFqn: "org.blockml.bml.type.Text",
        value: "8",
      })
      .seal();

    expect(sealed.kind).toBe("block");
    expect(sealed.block.name).toBe("Face");
    expect(sealed.block.type).toBe("com.example.widget.Face");
    expect(sealed.block.baseType).toBe("org.blockml.bml.core.Block");
    expect(sealed.block.is).toBe("A demo face");
    expect(sealed.source.namespaceBindings?.[""]).toBe("http://blockml.org/bml");
    expect(sealed.source.namespaceBindings?.xsi).toBe(
      "http://www.w3.org/2001/XMLSchema-instance",
    );
    expect(sealed.source.namespaceBindings?.core).toBe("org.blockml.bml.core");
    expect(sealed.source.namespaceBindings?.widget).toBe("com.example.widget");

    const xml = serialize(sealed);
    expect(xml.success).toBe(true);
    expect(xml.text).toContain("Face");
    expect(xml.text).toContain("com.example.widget");
    expect(xml.text).toMatch(/width/);

    const parsed = parse(xml.text, { filePath: "Face.bml", continueOnError: true });
    const errors = (parsed.diagnostics ?? []).filter((d) => d.severity === "error");
    expect(errors).toEqual([]);
    expect(parsed.document?.block.name).toBe("Face");
    expect(parsed.document?.block.type).toBe("com.example.widget.Face");
    const width = parsed.document?.block.members.find((m) => m.name === "width");
    expect(width?.kind).toBe("property");
    if (width?.kind === "property") {
      expect(width.value?.kind).toBe("literal");
      if (width.value?.kind === "literal") {
        expect(String(width.value.value)).toBe("8");
      }
    }
  });

  it("edit does not mutate the original sealed document", () => {
    const original = BomBuilder.create({
      type: "com.example.Alpha",
      is: "alpha",
    }).seal();
    const edited = BomBuilder.edit(original)
      .addProperty({ name: "label", typeFqn: "org.blockml.bml.type.Text", value: "hi" })
      .seal();
    expect(original.block.members).toHaveLength(0);
    expect(edited.block.members).toHaveLength(1);
    expect(edited.block.members[0]?.name).toBe("label");
  });

  it("edit of a parse-origin document can add a property and serialize", () => {
    const source = [
      '<block xmlns="http://blockml.org/bml"',
      ' xmlns:core="org.blockml.bml.core"',
      ' xmlns:test="com.example">',
      "  <name>Beta</name>",
      "  <type>test:Beta</type>",
      "  <baseType>core:Block</baseType>",
      "  <is>beta</is>",
      "</block>",
      "",
    ].join("\n");
    const parsed = parse(source, { filePath: "Beta.bml", continueOnError: true });
    expect(parsed.document).toBeTruthy();
    const sealed = BomBuilder.edit(parsed.document!)
      .addProperty({ name: "note", typeFqn: "org.blockml.bml.type.Text", value: "n" })
      .seal();
    const xml = serialize(sealed);
    expect(xml.text).toMatch(/note/);
    const round = parse(xml.text, { filePath: "Beta.bml", continueOnError: true });
    const errors = (round.diagnostics ?? []).filter((d) => d.severity === "error");
    expect(errors).toEqual([]);
    expect(round.document?.block.members.some((m) => m.name === "note")).toBe(true);
  });

  it("addCompositionChild emits TypeReference-style catalog sugar", () => {
    const sealed = BomBuilder.create({
      name: "Library",
      type: "com.example.Library",
      baseType: "org.blockml.bml.core.BlockLibrary",
      is: "test library",
    })
      .addAggregation({ name: "blocks", typeFqn: "org.blockml.bml.core.Block" })
      .addCompositionChild("blocks", "com.example.Foo")
      .seal();

    const child = sealed.block.compositions[0]?.children[0];
    expect(child?.kind).toBe("blockInstance");
    if (child?.kind === "blockInstance") {
      expect(child.instance.typeFqn).toBe("com.example.Foo");
    }

    const xml = serialize(sealed);
    expect(xml.text).toMatch(/<example:Foo\s*\/>/);
  });

  it("querySelector finds properties and aggregations", () => {
    const session = BomBuilder.create({ type: "com.example.Gamma", is: "g" })
      .addProperty({ name: "width", typeFqn: "org.blockml.bml.type.Text" })
      .addAggregation({ name: "blocks", typeFqn: "org.blockml.bml.core.Block" });
    expect(session.querySelector("properties.width")?.name).toBe("width");
    expect(session.querySelector("aggregations.blocks")?.kind).toBe("aggregation");
    expect(session.querySelector("properties.missing")).toBeUndefined();
  });

  it("setMemberValue updates a declared property", () => {
    const sealed = BomBuilder.create({ type: "com.example.Delta", is: "d" })
      .addProperty({ name: "title", typeFqn: "org.blockml.bml.type.Text" })
      .setMemberValue("title", "Hello")
      .seal();
    const title = sealed.block.members.find((m) => m.name === "title");
    expect(title?.kind).toBe("property");
    if (title?.kind === "property" && title.value?.kind === "literal") {
      expect(title.value.value).toBe("Hello");
    }
  });
});
