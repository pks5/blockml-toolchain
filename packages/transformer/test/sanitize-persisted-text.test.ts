import { describe, expect, it } from "vitest";
import { sanitizePersistedText } from "../src/execution/properties.js";

describe("sanitizePersistedText", () => {
  it("replaces U+FFFD and illegal XML chars with \\uXXXX", () => {
    expect(sanitizePersistedText("ladr\uFFFDo\u0000")).toBe("ladr\\uFFFDo\\u0000");
  });

  it("keeps ordinary XML text including quotes and newlines", () => {
    expect(sanitizePersistedText('say "hello"\n<raw>')).toBe('say "hello"\n<raw>');
  });
});
