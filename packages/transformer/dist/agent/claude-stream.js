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
export function formatClaudeStreamLine(line, options = {}) {
    const trimmed = line.trim();
    if (!trimmed) {
        return undefined;
    }
    try {
        return formatClaudeStreamEvent(JSON.parse(trimmed), options);
    }
    catch {
        return line.endsWith("\n") ? line : `${line}\n`;
    }
}
export function formatClaudeStreamEvent(event, options = {}) {
    if (!event || typeof event !== "object") {
        return undefined;
    }
    const record = event;
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
    leftover = "";
    streamedThinking = false;
    streamedText = false;
    thinkingLabeled = false;
    toolBuffers = new Map();
    push(chunk) {
        this.leftover += chunk;
        const lines = this.leftover.split(/\r?\n/);
        this.leftover = lines.pop() ?? "";
        let output = "";
        for (const line of lines) {
            output += this.formatLine(line);
        }
        return output;
    }
    flush() {
        if (!this.leftover.trim()) {
            this.leftover = "";
            return "";
        }
        const formatted = this.formatLine(this.leftover);
        this.leftover = "";
        return formatted;
    }
    formatLine(line) {
        let event;
        try {
            event = JSON.parse(line.trim());
        }
        catch {
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
    captureToolInput(event) {
        const start = eventContentBlockStart(event);
        if (start?.block.type === "tool_use") {
            const buffer = {
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
function formatAssistant(message, options) {
    const content = messageContent(message);
    if (!content) {
        return undefined;
    }
    const parts = [];
    for (const block of content) {
        if (block.type === "thinking" && !options.skipCompletedThinking) {
            const thinking = blockText(block);
            if (thinking) {
                parts.push(`[thinking]\n${thinking}\n`);
            }
        }
        else if (block.type === "text" && !options.skipCompletedText) {
            const text = blockText(block);
            if (text) {
                parts.push(`${text}\n`);
            }
        }
        else if (block.type === "tool_use" && typeof block.name === "string") {
            parts.push(formatToolUse(block.name, block.input));
        }
    }
    return parts.length > 0 ? parts.join("") : undefined;
}
function formatContentBlockStart(block) {
    if (!block || typeof block !== "object") {
        return undefined;
    }
    const record = block;
    if (record.type === "thinking") {
        return "[thinking]\n";
    }
    return undefined;
}
function formatDelta(delta) {
    if (!delta || typeof delta !== "object") {
        return undefined;
    }
    const record = delta;
    if (record.type === "thinking_delta") {
        return stringField(record, "thinking");
    }
    if (record.type === "text_delta") {
        return stringField(record, "text");
    }
    return undefined;
}
function formatToolUse(name, input) {
    const summary = summarizeToolInput(input);
    if (!summary) {
        return `[tool] ${name}\n`;
    }
    return `[tool] ${name}\n${summary}\n`;
}
function formatToolResult(message) {
    const content = messageContent(message);
    if (!content) {
        return undefined;
    }
    const results = [];
    for (const block of content) {
        if (block.type !== "tool_result") {
            continue;
        }
        const text = truncate(blockText(block) || toolResultFallback(block), TOOL_RESULT_LIMIT);
        results.push(text ? `[tool result]\n${text}\n` : "[tool result]\n");
    }
    return results.length > 0 ? results.join("") : undefined;
}
function formatFinalResult(record) {
    if (typeof record.result !== "string" || !record.result.trim()) {
        return undefined;
    }
    return `${record.result}\n`;
}
function summarizeToolInput(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        return typeof input === "string" && input.trim() ? truncate(input, TOOL_INPUT_LIMIT) : undefined;
    }
    const record = input;
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
    }
    catch {
        return undefined;
    }
}
function messageContent(message) {
    if (!message || typeof message !== "object") {
        return undefined;
    }
    const content = message.content;
    if (typeof content === "string") {
        return [{ type: "text", text: content }];
    }
    if (!Array.isArray(content)) {
        return undefined;
    }
    return content.filter((entry) => {
        return !!entry && typeof entry === "object";
    });
}
function toolResultFallback(block) {
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
function blockText(block) {
    if (typeof block.thinking === "string") {
        return block.thinking;
    }
    if (typeof block.text === "string") {
        return block.text;
    }
    return contentText(block.content);
}
function contentText(content) {
    if (typeof content === "string") {
        return content;
    }
    if (!Array.isArray(content)) {
        return "";
    }
    return content
        .filter((entry) => !!entry && typeof entry === "object")
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
function stringField(record, key) {
    const value = record[key];
    return typeof value === "string" ? value : undefined;
}
function truncate(value, limit) {
    if (value.length <= limit) {
        return value;
    }
    return `${value.slice(0, limit)}\n…`;
}
function eventDeltaType(event) {
    const delta = eventDelta(event);
    if (!delta || typeof delta !== "object") {
        return undefined;
    }
    const type = delta.type;
    return typeof type === "string" ? type : undefined;
}
function isThinkingStart(event) {
    const block = eventContentBlock(event);
    return !!block && block.type === "thinking";
}
function isCompleteAssistant(event) {
    return !!event && typeof event === "object" && event.type === "assistant";
}
function eventContentBlock(event) {
    return eventContentBlockStart(event)?.block;
}
function eventContentBlockStart(event) {
    const record = unwrapStreamEvent(event);
    if (!record || record.type !== "content_block_start") {
        return undefined;
    }
    if (!record.content_block || typeof record.content_block !== "object") {
        return undefined;
    }
    return {
        index: eventIndex(record),
        block: record.content_block,
    };
}
function eventContentBlockDelta(event) {
    const record = unwrapStreamEvent(event);
    if (!record || record.type !== "content_block_delta") {
        return undefined;
    }
    if (!record.delta || typeof record.delta !== "object") {
        return undefined;
    }
    return {
        index: eventIndex(record),
        delta: record.delta,
    };
}
function eventIndex(record) {
    return typeof record.index === "number" ? record.index : 0;
}
function unwrapStreamEvent(event) {
    if (!event || typeof event !== "object") {
        return undefined;
    }
    const record = event;
    if (record.type === "stream_event") {
        return unwrapStreamEvent(record.event);
    }
    return record;
}
function mergeToolInputs(event, buffers) {
    if (!event || typeof event !== "object") {
        return event;
    }
    const record = event;
    const message = record.message;
    if (!message || typeof message !== "object") {
        return event;
    }
    const content = message.content;
    if (!Array.isArray(content)) {
        return event;
    }
    const merged = content.map((entry) => {
        if (!entry || typeof entry !== "object") {
            return entry;
        }
        const block = entry;
        if (block.type !== "tool_use" || !isEmptyToolInput(block.input)) {
            return entry;
        }
        const buffer = findToolBuffer(buffers, block);
        if (!buffer?.json) {
            return entry;
        }
        try {
            return { ...block, input: JSON.parse(buffer.json) };
        }
        catch {
            return entry;
        }
    });
    return {
        ...record,
        message: {
            ...message,
            content: merged,
        },
    };
}
function findToolBuffer(buffers, block) {
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
function isEmptyToolInput(input) {
    if (input == null) {
        return true;
    }
    return typeof input === "object" && !Array.isArray(input) && Object.keys(input).length === 0;
}
function eventDelta(event) {
    return eventContentBlockDelta(event)?.delta;
}
//# sourceMappingURL=claude-stream.js.map