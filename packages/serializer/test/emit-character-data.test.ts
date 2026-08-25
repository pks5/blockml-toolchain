import { describe, expect, it } from "vitest";
import { emitCharacterData, XmlWriter } from "../src/emit/xml.js";

describe("emitCharacterData", () => {
  it("indents each line of multiline text", () => {
    const writer = new XmlWriter(2);
    writer.line("<documentation>");
    writer.pushDepth();
    emitCharacterData(
      writer,
      "Hello,\nthis is a test.\n    - but this is intended",
    );
    writer.popDepth();
    writer.line("</documentation>");
    expect(writer.toString()).toBe(
      [
        "<documentation>",
        "  Hello,",
        "  this is a test.",
        "      - but this is intended",
        "</documentation>",
      ].join("\n"),
    );
  });

  it("wraps multiline CDATA so each content line is indented", () => {
    const writer = new XmlWriter(2);
    writer.pushDepth();
    emitCharacterData(writer, "Hello,\n    nested", "cdata");
    expect(writer.toString()).toBe(
      ["  <![CDATA[", "  Hello,", "      nested", "  ]]>"].join("\n"),
    );
  });

  it("keeps single-line CDATA on one line", () => {
    const writer = new XmlWriter(2);
    writer.pushDepth();
    emitCharacterData(writer, "hello", "cdata");
    expect(writer.toString()).toBe("  <![CDATA[hello]]>");
  });
});
