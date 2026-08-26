import { describe, expect, it } from "vitest";
import { formatDiagnostic } from "../src/cli.js";
import {
  colorizeLine,
  diagnosticKind,
  formatCliOutput,
  shouldUseColor,
  streamForKind,
  writeCliOutput,
  type CliWriteStream,
} from "../src/cli-style.js";

function memoryStream(tty = false): CliWriteStream & { text: string } {
  let text = "";
  return {
    isTTY: tty,
    write(chunk: string) {
      text += chunk;
      return true;
    },
    get text() {
      return text;
    },
  };
}

describe("CLI24 color scheme", () => {
  it("maps diagnostic severities including future recommendation", () => {
    expect(diagnosticKind("error")).toBe("error");
    expect(diagnosticKind("warning")).toBe("warning");
    expect(diagnosticKind("recommendation")).toBe("recommendation");
    expect(diagnosticKind("info")).toBe("info");
  });

  it("routes error and warning to stderr; other kinds to stdout", () => {
    expect(streamForKind("error")).toBe("stderr");
    expect(streamForKind("warning")).toBe("stderr");
    expect(streamForKind("info")).toBe("stdout");
    expect(streamForKind("success")).toBe("stdout");
    expect(streamForKind("recommendation")).toBe("stdout");
  });

  it("colorizes error red, warning yellow, recommendation blue, success green, info plain", () => {
    expect(colorizeLine("error", "boom", true)).toBe("\x1b[31mboom\x1b[0m");
    expect(colorizeLine("warning", "careful", true)).toBe("\x1b[33mcareful\x1b[0m");
    expect(colorizeLine("recommendation", "try this", true)).toBe(
      "\x1b[34mtry this\x1b[0m",
    );
    expect(colorizeLine("success", "ok", true)).toBe("\x1b[32mok\x1b[0m");
    expect(colorizeLine("info", "hello", true)).toBe("hello");
  });

  it("leaves lines uncolored when color is disabled", () => {
    expect(colorizeLine("error", "boom", false)).toBe("boom");
    expect(colorizeLine("success", "ok", false)).toBe("ok");
  });

  it("honors NO_COLOR and FORCE_COLOR", () => {
    expect(shouldUseColor({ isTTY: true }, { NO_COLOR: "1" })).toBe(false);
    expect(shouldUseColor({ isTTY: false }, { FORCE_COLOR: "1" })).toBe(true);
    expect(shouldUseColor({ isTTY: true }, { FORCE_COLOR: "0" })).toBe(false);
    expect(shouldUseColor({ isTTY: true }, {})).toBe(true);
    expect(shouldUseColor({ isTTY: false }, {})).toBe(false);
  });

  it("writes colored lines to the matching stream", () => {
    const stdout = memoryStream();
    const stderr = memoryStream();
    writeCliOutput(
      [
        { kind: "info", text: "working" },
        { kind: "success", text: "Compilation succeeded." },
        { kind: "warning", text: "warning W1 — almost" },
        { kind: "error", text: "error E1 — bad" },
        { kind: "recommendation", text: "recommendation R1 — later" },
      ],
      { stdout, stderr, env: { FORCE_COLOR: "1" } },
    );
    expect(stdout.text).toBe(
      "working\n" +
        "\x1b[32mCompilation succeeded.\x1b[0m\n" +
        "\x1b[34mrecommendation R1 — later\x1b[0m\n",
    );
    expect(stderr.text).toBe(
      "\x1b[33mwarning W1 — almost\x1b[0m\n" + "\x1b[31merror E1 — bad\x1b[0m\n",
    );
  });

  it("keeps formatDiagnostic and runCli transcripts uncolored", () => {
    const formatted = formatDiagnostic({
      severity: "error",
      code: "BML_TEST",
      message: "nope",
      source: { file: "Foo.bml", line: 1 },
    });
    expect(formatted).toBe("error BML_TEST Foo.bml:1 — nope");
    expect(formatted).not.toMatch(/\x1b\[/);
    expect(
      formatCliOutput([
        { kind: "success", text: "Compilation succeeded." },
        { kind: "error", text: "error E1 — bad" },
      ]),
    ).toBe("Compilation succeeded.\nerror E1 — bad\n");
  });
});
