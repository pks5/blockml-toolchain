import { describe, expect, it } from "vitest";
import { formatElapsed, formatIsoDuration } from "../src/execution/duration.js";
import { formatTransformLifecycle } from "../src/execution/lifecycle-events.js";

describe("formatIsoDuration", () => {
  it("formats zero and sub-second values", () => {
    expect(formatIsoDuration(0)).toBe("PT0S");
    expect(formatIsoDuration(250)).toBe("PT0.25S");
  });

  it("formats minutes and hours", () => {
    expect(formatIsoDuration(2 * 60_000 + 3_000)).toBe("PT2M3S");
    expect(formatIsoDuration(3_600_000 + 5 * 60_000 + 12_400)).toBe("PT1H5M12.4S");
  });
});

describe("formatElapsed", () => {
  it("uses milliseconds under one second", () => {
    expect(formatElapsed(347)).toBe("347ms");
  });

  it("uses compact units for longer intervals", () => {
    expect(formatElapsed(12_400)).toBe("12.4s");
    expect(formatElapsed(2 * 60_000 + 3_000)).toBe("2m 3s");
    expect(formatElapsed(3_600_000 + 5 * 60_000 + 12_000)).toBe("1h 5m 12s");
  });
});

describe("formatTransformLifecycle", () => {
  it("prints total elapsed time on the complete line", () => {
    expect(
      formatTransformLifecycle({
        kind: "transformationComplete",
        status: "Succeeded",
        terminalFqn: "com.example.model._meta.transform.succeeded.T00001",
        durationMs: 83_000,
        duration: "PT1M23S",
      }),
    ).toBe(
      "Transformed com.example.model._meta.transform.succeeded.T00001\nElapsed 1m 23s",
    );
  });
});
