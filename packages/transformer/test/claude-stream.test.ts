import { describe, expect, it } from "vitest";
import {
  ClaudeLiveFormatter,
  formatClaudeStreamLine,
} from "../src/agent/claude-stream.js";

describe("Claude live stream formatting", () => {
  it("renders thinking, text, and tool use from assistant events", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: {
        content: [
          { type: "thinking", thinking: "I should search the model." },
          { type: "text", text: "Working on the Task." },
          { type: "tool_use", name: "Bash" },
        ],
      },
    });
    expect(formatClaudeStreamLine(line)).toBe(
      "[thinking]\nI should search the model.\nWorking on the Task.\n[tool] Bash\n",
    );
  });

  it("streams thinking deltas without extra wrapping", () => {
    const line = JSON.stringify({
      type: "content_block_delta",
      delta: { type: "thinking_delta", thinking: "next " },
    });
    expect(formatClaudeStreamLine(line)).toBe("next ");
  });

  it("formats complete JSON lines as they arrive", () => {
    const formatter = new ClaudeLiveFormatter();
    const first = formatter.push(
      '{"type":"assistant","message":{"content":[{"type":"text","text":"Hello"}]}}\n{"type":',
    );
    const second = formatter.push('"system","subtype":"init"}\n');
    expect(first).toBe("Hello\n");
    expect(second).toBe("");
  });

  it("passes through non-JSON output", () => {
    expect(formatClaudeStreamLine("plain progress")).toBe("plain progress\n");
  });
});
