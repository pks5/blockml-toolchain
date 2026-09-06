/** ISO 8601 duration from elapsed milliseconds, e.g. PT1.5S, PT2M3S, PT1H2M3.4S. */
export function formatIsoDuration(ms: number): string {
  const clamped = Math.max(0, ms);
  const hours = Math.floor(clamped / 3_600_000);
  const minutes = Math.floor((clamped % 3_600_000) / 60_000);
  const seconds = (clamped % 60_000) / 1000;
  const secondText = formatIsoSeconds(seconds);
  let time = "";
  if (hours > 0) {
    time += `${hours}H`;
  }
  if (minutes > 0) {
    time += `${minutes}M`;
  }
  if (secondText !== "0S" || time === "") {
    time += secondText;
  }
  return `PT${time}`;
}

/** Compact human elapsed time, e.g. 347ms, 12.4s, 2m 3s, 1h 5m 12s. */
export function formatElapsed(ms: number): string {
  const clamped = Math.max(0, Math.round(ms));
  if (clamped < 1000) {
    return `${clamped}ms`;
  }
  const hours = Math.floor(clamped / 3_600_000);
  const minutes = Math.floor((clamped % 3_600_000) / 60_000);
  const seconds = (clamped % 60_000) / 1000;
  if (hours > 0) {
    return `${hours}h ${minutes}m ${Math.round(seconds)}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${Math.round(seconds)}s`;
  }
  return `${seconds.toFixed(1)}s`;
}

function formatIsoSeconds(seconds: number): string {
  if (seconds === 0) {
    return "0S";
  }
  const rounded = Math.round(seconds * 1000) / 1000;
  return `${rounded}S`;
}
