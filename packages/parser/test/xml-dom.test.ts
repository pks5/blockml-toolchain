import { afterEach, describe, expect, it, vi } from "vitest";
import { parse } from "../src/parse.js";
import { parseXmlDom } from "../src/pipeline/xml-dom.js";

const DUPLICATE_XMLNS = [
  '<?xml version="1.0"?>',
  "<block",
  '  xmlns="http://blockml.org/bml"',
  '  xmlns:foo="org.example.foo"',
  '  xmlns:foo="org.example.foo">',
  "  <name>Dup</name>",
  "  <type>foo:Dup</type>",
  "</block>",
  "",
].join("\n");

describe("XML diagnostics include file path", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports redefined xmlns with the authored file path and line > 1", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = parse(DUPLICATE_XMLNS, {
      filePath: "dup.bml",
      continueOnError: true,
    });
    const xmlErrors = result.diagnostics.filter((d) => d.code === "BML_MALFORMED_XML");
    expect(xmlErrors.length).toBeGreaterThan(0);
    expect(xmlErrors[0]?.source.file).toBe("dup.bml");
    expect(xmlErrors[0]?.source.line).toBeGreaterThan(1);
    expect(xmlErrors[0]?.message).not.toMatch(/@#/);
    expect(
      errorSpy.mock.calls.some((args) => String(args[0]).includes("@#")),
    ).toBe(false);
  });

  it("captures xmldom errors without dumping @# to console", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { errors } = parseXmlDom(DUPLICATE_XMLNS, "dup.bml");
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.message).not.toMatch(/@#/);
    expect(errors[0]?.line).toBeGreaterThan(1);
    expect(
      errorSpy.mock.calls.some((args) => String(args[0]).includes("@#")),
    ).toBe(false);
  });
});
