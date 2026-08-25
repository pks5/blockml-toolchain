import type { XmlTrivia } from "@blockml/bom";

export class XmlWriter {
  private parts: string[] = [];
  private depth = 0;

  constructor(private indent: number) {}

  line(raw = ""): void {
    if (this.indent === 0) {
      this.parts.push(raw);
      return;
    }
    const pad = " ".repeat(this.depth * this.indent);
    this.parts.push(pad + raw);
  }

  blank(): void {
    this.parts.push("");
  }

  pushDepth(): void {
    this.depth++;
  }

  popDepth(): void {
    this.depth--;
  }

  comments(trivia: XmlTrivia | undefined, trailing = false): void {
    if (!trivia) {
      return;
    }
    const list = trailing ? trivia.trailingComments : trivia.leadingComments;
    if (!list?.length) {
      return;
    }
    for (const body of list) {
      this.line(`<!--${body}-->`);
    }
    if (trailing && list.length > 0) {
      this.blank();
    }
  }

  toString(): string {
    return this.parts.join("\n");
  }
}

export function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

export function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

export function needsCData(text: string): boolean {
  return /[<&]/.test(text);
}

export function emitCharacterData(
  writer: XmlWriter,
  text: string,
  form?: "text" | "cdata",
): void {
  const lines = text.split("\n");
  if (form === "cdata") {
    if (lines.length <= 1) {
      writer.line(`<![CDATA[${text}]]>`);
      return;
    }
    writer.line("<![CDATA[");
    for (const line of lines) {
      writer.line(line);
    }
    writer.line("]]>");
    return;
  }
  for (const line of lines) {
    writer.line(escapeText(line));
  }
}

export function formatBoolean(value: boolean): string {
  return value ? "true" : "false";
}

export function formatMemberValue(value: unknown): string {
  if (typeof value === "boolean") {
    return formatBoolean(value);
  }
  if (typeof value === "string") {
    return escapeAttr(value);
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (Array.isArray(value) || (typeof value === "object" && value !== null)) {
    return escapeAttr(JSON.stringify(value).replace(/"([^"]+)":/g, "$1:"));
  }
  return escapeAttr(String(value));
}
