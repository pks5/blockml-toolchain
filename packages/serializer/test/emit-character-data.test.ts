import { describe, expect, it } from "vitest";
import { emitCharacterData, escapeAttr, escapeText, XmlWriter } from "../src/emit/xml.js";

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

  it("escapes U+FFFD and illegal XML chars in text", () => {
    expect(escapeText("ladr\uFFFDo\u0000")).toBe("ladr\\uFFFDo\\u0000");
    expect(escapeText("a < b & c")).toBe("a &lt; b &amp; c");
  });

  it("escapes U+FFFD and illegal XML chars in attributes", () => {
    expect(escapeAttr('say "ladr\uFFFDo"')).toBe("say &quot;ladr\\uFFFDo&quot;");
  });

  it("sanitizes U+FFFD inside CDATA", () => {
    const writer = new XmlWriter(0);
    emitCharacterData(writer, "ladr\uFFFDo", "cdata");
    expect(writer.toString()).toBe("<![CDATA[ladr\\uFFFDo]]>");
  });
});
