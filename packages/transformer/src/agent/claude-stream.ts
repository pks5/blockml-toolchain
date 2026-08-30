const TOOL_INPUT_KEYS = [
  "command",
  "file_path",
  "path",
  "pattern",
  "query",
  "prompt",
  "glob",
  "url",
  "search_term",
];

const TOOL_INPUT_LIMIT = 800;
const TOOL_RESULT_LIMIT = 4000;

export interface FormatClaudeStreamOptions {
  skipCompletedThinking?: boolean;
  skipCompletedText?: boolean;
}

export function formatClaudeStreamLine(
  line: string,
  options: FormatClaudeStreamOptions = {},
): string | undefined {
  const trimmed = line.trim();
  if (!trimmed) {
    return undefined;
  }
  try {
    return formatClaudeStreamEvent(JSON.parse(trimmed) as unknown, options);
  } catch {
    return line.endsWith("\n") ? line : `${line}\n`;
  }
}

export function formatClaudeStreamEvent(
  event: unknown,
  options: FormatClaudeStreamOptions = {},
): string | undefined {
  if (!event || typeof event !== "object") {
    return undefined;
  }
  const record = event as Record<string, unknown>;
  switch (record.type) {
    case "assistant":
      return formatAssistant(record.message, options);
    case "content_block_start":
      return formatContentBlockStart(record.content_block);
    case "content_block_delta":
      return formatDelta(record.delta);
    case "content_block_stop":
      return "\n";
    case "stream_event":
      return formatClaudeStreamEvent(record.event, options);
    case "user":
      return formatToolResult(record.message);
    case "result":
      return formatFinalResult(record);
    default:
      return undefined;
  }
}

export class ClaudeLiveFormatter {
  private leftover = "";
  private streamedThinking = false;
  private streamedText = false;
  private thinkingLabeled = false;
  private readonly toolBuffers = new Map<number, { id?: string; name: string; json: string }>();

  push(chunk: string): string {
    this.leftover += chunk;
    const lines = this.leftover.split(/\r?\n/);
    this.leftover = lines.pop() ?? "";
    let output = "";
    for (const line of lines) {
      output += this.formatLine(line);
    }
    return output;
  }

  flush(): string {
    if (!this.leftover.trim()) {
      this.leftover = "";
      return "";
    }
    const formatted = this.formatLine(this.leftover);
    this.leftover = "";
    return formatted;
  }

  private formatLine(line: string): string {
    let event: unknown;
    try {
      event = JSON.parse(line.trim());
    } catch {
      const formatted = formatClaudeStreamLine(line);
      return formatted ?? "";
    }
    this.captureToolInput(event);
    if (isCompleteAssistant(event)) {
      event = mergeToolInputs(event, this.toolBuffers);
      this.toolBuffers.clear();
    }
    const deltaType = eventDeltaType(event);
    if (deltaType === "thinking_delta") {
      this.streamedThinking = true;
    }
    if (deltaType === "text_delta") {
      this.streamedText = true;
    }
    if (isThinkingStart(event)) {
      this.thinkingLabeled = true;
    }
    let prefix = "";
    if (deltaType === "thinking_delta" && !this.thinkingLabeled) {
      prefix = "[thinking]\n";
      this.thinkingLabeled = true;
    }
    const formatted = formatClaudeStreamEvent(event, {
      skipCompletedThinking: this.streamedThinking,
      skipCompletedText: this.streamedText,
    });
    if (isCompleteAssistant(event)) {
      this.streamedThinking = false;
      this.streamedText = false;
      this.thinkingLabeled = false;
    }
    if (!formatted) {
      return prefix;
    }
    return `${prefix}${formatted}`;
  }

  private captureToolInput(event: unknown): void {
    const start = eventContentBlockStart(event);
    if (start?.block.type === "tool_use") {
      const buffer: { id?: string; name: string; json: string } = {
        name: typeof start.block.name === "string" ? start.block.name : "",
        json: "",
      };
      if (typeof start.block.id === "string") {
        buffer.id = start.block.id;
      }
      this.toolBuffers.set(start.index, buffer);
    }
    const delta = eventContentBlockDelta(event);
    if (delta?.delta.type === "input_json_delta" && typeof delta.delta.partial_json === "string") {
      const buffer = this.toolBuffers.get(delta.index);
      if (buffer) {
        buffer.json += delta.delta.partial_json;
      }
    }
  }
}

function formatAssistant(
  message: unknown,
  options: FormatClaudeStreamOptions,
): string | undefined {
  const content = messageContent(message);
  if (!content) {
    return undefined;
  }
  const parts: string[] = [];
  for (const block of content) {
    if (block.type === "thinking" && !options.skipCompletedThinking) {
      const thinking = blockText(block);
      if (thinking) {
        parts.push(`[thinking]\n${thinking}\n`);
      }
    } else if (block.type === "text" && !options.skipCompletedText) {
      const text = blockText(block);
      if (text) {
        parts.push(`${text}\n`);
      }
    } else if (block.type === "tool_use" && typeof block.name === "string") {
      parts.push(formatToolUse(block.name, block.input));
    }
  }
  return parts.length > 0 ? parts.join("") : undefined;
}

function formatContentBlockStart(block: unknown): string | undefined {
  if (!block || typeof block !== "object") {
    return undefined;
  }
  const record = block as Record<string, unknown>;
  if (record.type === "thinking") {
    return "[thinking]\n";
  }
  return undefined;
}

function formatDelta(delta: unknown): string | undefined {
  if (!delta || typeof delta !== "object") {
    return undefined;
  }
  const record = delta as Record<string, unknown>;
  if (record.type === "thinking_delta") {
    return stringField(record, "thinking");
  }
  if (record.type === "text_delta") {
    return stringField(record, "text");
  }
  return undefined;
}

function formatToolUse(name: string, input: unknown): string {
  const summary = summarizeToolInput(input);
  if (!summary) {
    return `[tool] ${name}\n`;
  }
  return `[tool] ${name}\n${summary}\n`;
}

function formatToolResult(message: unknown): string | undefined {
  const content = messageContent(message);
  if (!content) {
    return undefined;
  }
  const results: string[] = [];
  for (const block of content) {
    if (block.type !== "tool_result") {
      continue;
    }
    const text = truncate(blockText(block) || toolResultFallback(block), TOOL_RESULT_LIMIT);
    results.push(text ? `[tool result]\n${text}\n` : "[tool result]\n");
  }
  return results.length > 0 ? results.join("") : undefined;
}

function formatFinalResult(record: Record<string, unknown>): string | undefined {
  if (typeof record.result !== "string" || !record.result.trim()) {
    return undefined;
  }
  return `${record.result}\n`;
}

function summarizeToolInput(input: unknown): string | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return typeof input === "string" && input.trim() ? truncate(input, TOOL_INPUT_LIMIT) : undefined;
  }
  const record = input as Record<string, unknown>;
  if (Object.keys(record).length === 0) {
    return undefined;
  }
  for (const key of TOOL_INPUT_KEYS) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return truncate(value, TOOL_INPUT_LIMIT);
    }
  }
  try {
    return truncate(JSON.stringify(record), TOOL_INPUT_LIMIT);
  } catch {
    return undefined;
  }
}

function messageContent(message: unknown): Array<Record<string, unknown>> | undefined {
  if (!message || typeof message !== "object") {
    return undefined;
  }
  const content = (message as Record<string, unknown>).content;
  if (typeof content === "string") {
    return [{ type: "text", text: content }];
  }
  if (!Array.isArray(content)) {
    return undefined;
  }
  return content.filter((entry): entry is Record<string, unknown> => {
    return !!entry && typeof entry === "object";
  });
}

function toolResultFallback(block: Record<string, unknown>): string {
  for (const key of ["output", "result", "error"]) {
    const value = block[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  if (block.is_error === true) {
    return "(error)";
  }
  return "";
}

function blockText(block: Record<string, unknown>): string {
  if (typeof block.thinking === "string") {
    return block.thinking;
  }
  if (typeof block.text === "string") {
    return block.text;
  }
  return contentText(block.content);
}

function contentText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object")
    .map((entry) => {
      if (typeof entry.text === "string") {
        return entry.text;
      }
      if (typeof entry.thinking === "string") {
        return entry.thinking;
      }
      return contentText(entry.content);
    })
    .filter(Boolean)
    .join("");
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function truncate(value: string, limit: number): string {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit)}\n…`;
}

function eventDeltaType(event: unknown): string | undefined {
  const delta = eventDelta(event);
  if (!delta || typeof delta !== "object") {
    return undefined;
  }
  const type = (delta as Record<string, unknown>).type;
  return typeof type === "string" ? type : undefined;
}

function isThinkingStart(event: unknown): boolean {
  const block = eventContentBlock(event);
  return !!block && block.type === "thinking";
}

function isCompleteAssistant(event: unknown): boolean {
  return !!event && typeof event === "object" && (event as Record<string, unknown>).type === "assistant";
}

function eventContentBlock(event: unknown): Record<string, unknown> | undefined {
  return eventContentBlockStart(event)?.block;
}

function eventContentBlockStart(
  event: unknown,
): { index: number; block: Record<string, unknown> } | undefined {
  const record = unwrapStreamEvent(event);
  if (!record || record.type !== "content_block_start") {
    return undefined;
  }
  if (!record.content_block || typeof record.content_block !== "object") {
    return undefined;
  }
  return {
    index: eventIndex(record),
    block: record.content_block as Record<string, unknown>,
  };
}

function eventContentBlockDelta(
  event: unknown,
): { index: number; delta: Record<string, unknown> } | undefined {
  const record = unwrapStreamEvent(event);
  if (!record || record.type !== "content_block_delta") {
    return undefined;
  }
  if (!record.delta || typeof record.delta !== "object") {
    return undefined;
  }
  return {
    index: eventIndex(record),
    delta: record.delta as Record<string, unknown>,
  };
}

function eventIndex(record: Record<string, unknown>): number {
  return typeof record.index === "number" ? record.index : 0;
}

function unwrapStreamEvent(event: unknown): Record<string, unknown> | undefined {
  if (!event || typeof event !== "object") {
    return undefined;
  }
  const record = event as Record<string, unknown>;
  if (record.type === "stream_event") {
    return unwrapStreamEvent(record.event);
  }
  return record;
}

function mergeToolInputs(
  event: unknown,
  buffers: Map<number, { id?: string; name: string; json: string }>,
): unknown {
  if (!event || typeof event !== "object") {
    return event;
  }
  const record = event as Record<string, unknown>;
  const message = record.message;
  if (!message || typeof message !== "object") {
    return event;
  }
  const content = (message as Record<string, unknown>).content;
  if (!Array.isArray(content)) {
    return event;
  }
  const merged = content.map((entry) => {
    if (!entry || typeof entry !== "object") {
      return entry;
    }
    const block = entry as Record<string, unknown>;
    if (block.type !== "tool_use" || !isEmptyToolInput(block.input)) {
      return entry;
    }
    const buffer = findToolBuffer(buffers, block);
    if (!buffer?.json) {
      return entry;
    }
    try {
      return { ...block, input: JSON.parse(buffer.json) as unknown };
    } catch {
      return entry;
    }
  });
  return {
    ...record,
    message: {
      ...(message as Record<string, unknown>),
      content: merged,
    },
  };
}

function findToolBuffer(
  buffers: Map<number, { id?: string; name: string; json: string }>,
  block: Record<string, unknown>,
): { id?: string; name: string; json: string } | undefined {
  const id = typeof block.id === "string" ? block.id : undefined;
  if (id) {
    for (const buffer of buffers.values()) {
      if (buffer.id === id) {
        return buffer;
      }
    }
  }
  const name = typeof block.name === "string" ? block.name : undefined;
  if (name) {
    for (const buffer of buffers.values()) {
      if (buffer.name === name && buffer.json) {
        return buffer;
      }
    }
  }
  return undefined;
}

function isEmptyToolInput(input: unknown): boolean {
  if (input == null) {
    return true;
  }
  return typeof input === "object" && !Array.isArray(input) && Object.keys(input as object).length === 0;
}

function eventDelta(event: unknown): unknown {
  return eventContentBlockDelta(event)?.delta;
}
