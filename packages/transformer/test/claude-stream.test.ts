import { describe, expect, it } from "vitest";
import {
  ClaudeLiveFormatter,
  formatClaudeStreamLine,
} from "../src/agent/claude-stream.js";

describe("Claude live stream formatting", () => {
  it("renders thinking, text, and tool use with input from assistant events", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: {
        content: [
          { type: "thinking", thinking: "I should search the model." },
          { type: "text", text: "Working on the Task." },
          { type: "tool_use", name: "Bash", input: { command: "npx blockml search joke" } },
        ],
      },
    });
    expect(formatClaudeStreamLine(line)).toBe(
      "[thinking]\nI should search the model.\nWorking on the Task.\n[tool] Bash\nnpx blockml search joke\n",
    );
  });

  it("renders tool result content instead of an empty placeholder", () => {
    const line = JSON.stringify({
      type: "user",
      message: {
        content: [
          {
            type: "tool_result",
            content: [{ type: "text", text: "JokeTest.bml\n" }],
          },
        ],
      },
    });
    expect(formatClaudeStreamLine(line)).toBe("[tool result]\nJokeTest.bml\n\n");
  });

  it("streams thinking deltas without extra wrapping", () => {
    const line = JSON.stringify({
      type: "content_block_delta",
      delta: { type: "thinking_delta", thinking: "next " },
    });
    expect(formatClaudeStreamLine(line)).toBe("next ");
  });

  it("unwraps nested stream_event thinking", () => {
    const line = JSON.stringify({
      type: "stream_event",
      event: {
        type: "content_block_delta",
        delta: { type: "thinking_delta", thinking: "because " },
      },
    });
    expect(formatClaudeStreamLine(line)).toBe("because ");
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

  it("does not repeat thinking after it was already streamed as deltas", () => {
    const formatter = new ClaudeLiveFormatter();
    const streamed = formatter.push(
      `${JSON.stringify({
        type: "stream_event",
        event: {
          type: "content_block_start",
          content_block: { type: "thinking", thinking: "" },
        },
      })}\n${JSON.stringify({
        type: "stream_event",
        event: {
          type: "content_block_delta",
          delta: { type: "thinking_delta", thinking: "search first" },
        },
      })}\n${JSON.stringify({
        type: "assistant",
        message: {
          content: [
            { type: "thinking", thinking: "search first" },
            { type: "tool_use", name: "Read", input: { file_path: "Task.bml" } },
          ],
        },
      })}\n`,
    );
    expect(streamed).toBe("[thinking]\nsearch first[tool] Read\nTask.bml\n");
  });

  it("keeps complete assistant text when only thinking was streamed", () => {
    const formatter = new ClaudeLiveFormatter();
    const streamed = formatter.push(
      `${JSON.stringify({
        type: "stream_event",
        event: {
          type: "content_block_delta",
          delta: { type: "thinking_delta", thinking: "search first" },
        },
      })}\n${JSON.stringify({
        type: "assistant",
        message: {
          content: [
            { type: "thinking", thinking: "search first" },
            { type: "text", text: "Opening the Task." },
            { type: "tool_use", name: "Read", input: { file_path: "Task.bml" } },
          ],
        },
      })}\n`,
    );
    expect(streamed).toBe(
      "[thinking]\nsearch firstOpening the Task.\n[tool] Read\nTask.bml\n",
    );
  });

  it("passes through non-JSON output", () => {
    expect(formatClaudeStreamLine("plain progress")).toBe("plain progress\n");
  });
});
