export function formatClaudeStreamLine(line) {
    const trimmed = line.trim();
    if (!trimmed) {
        return undefined;
    }
    try {
        return formatClaudeStreamEvent(JSON.parse(trimmed));
    }
    catch {
        return line.endsWith("\n") ? line : `${line}\n`;
    }
}
export function formatClaudeStreamEvent(event) {
    if (!event || typeof event !== "object") {
        return undefined;
    }
    const record = event;
    switch (record.type) {
        case "assistant":
            return formatAssistant(record.message);
        case "content_block_delta":
            return formatDelta(record.delta);
        case "stream_event":
            return formatNestedStreamEvent(record.event);
        case "user":
            return formatToolResult(record.message);
        default:
            return undefined;
    }
}
export class ClaudeLiveFormatter {
    leftover = "";
    push(chunk) {
        this.leftover += chunk;
        const lines = this.leftover.split(/\r?\n/);
        this.leftover = lines.pop() ?? "";
        let output = "";
        for (const line of lines) {
            const formatted = formatClaudeStreamLine(line);
            if (formatted) {
                output += formatted;
            }
        }
        return output;
    }
    flush() {
        if (!this.leftover.trim()) {
            this.leftover = "";
            return "";
        }
        const formatted = formatClaudeStreamLine(this.leftover);
        this.leftover = "";
        return formatted ?? "";
    }
}
function formatAssistant(message) {
    const content = messageContent(message);
    if (!content) {
        return undefined;
    }
    const parts = [];
    for (const block of content) {
        if (block.type === "thinking" && typeof block.thinking === "string" && block.thinking) {
            parts.push(`[thinking]\n${block.thinking}\n`);
        }
        else if (block.type === "text" && typeof block.text === "string" && block.text) {
            parts.push(`${block.text}\n`);
        }
        else if (block.type === "tool_use" && typeof block.name === "string") {
            parts.push(`[tool] ${block.name}\n`);
        }
    }
    return parts.length > 0 ? parts.join("") : undefined;
}
function formatDelta(delta) {
    if (!delta || typeof delta !== "object") {
        return undefined;
    }
    const record = delta;
    if (record.type === "thinking_delta" && typeof record.thinking === "string") {
        return record.thinking;
    }
    if (record.type === "text_delta" && typeof record.text === "string") {
        return record.text;
    }
    return undefined;
}
function formatNestedStreamEvent(event) {
    if (!event || typeof event !== "object") {
        return undefined;
    }
    const record = event;
    if (record.type === "content_block_delta") {
        return formatDelta(record.delta);
    }
    return undefined;
}
function formatToolResult(message) {
    const content = messageContent(message);
    if (!content) {
        return undefined;
    }
    for (const block of content) {
        if (block.type === "tool_result") {
            return `[tool result]\n`;
        }
    }
    return undefined;
}
function messageContent(message) {
    if (!message || typeof message !== "object") {
        return undefined;
    }
    const content = message.content;
    if (!Array.isArray(content)) {
        return undefined;
    }
    return content.filter((entry) => {
        return !!entry && typeof entry === "object";
    });
}
//# sourceMappingURL=claude-stream.js.map