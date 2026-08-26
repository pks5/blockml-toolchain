/** CLI24 message kinds and terminal colors. */
export type CliStreamKind =
  | "error"
  | "warning"
  | "recommendation"
  | "info"
  | "success";

export interface CliOutputLine {
  kind: CliStreamKind;
  text: string;
}

export interface CliWriteStream {
  write(chunk: string): unknown;
  isTTY?: boolean;
}

const ANSI: Record<Exclude<CliStreamKind, "info">, string> = {
  error: "\x1b[31m",
  warning: "\x1b[33m",
  recommendation: "\x1b[34m",
  success: "\x1b[32m",
};
const RESET = "\x1b[0m";

export function diagnosticKind(severity: string): CliStreamKind {
  if (severity === "error") {
    return "error";
  }
  if (severity === "warning") {
    return "warning";
  }
  if (severity === "recommendation") {
    return "recommendation";
  }
  return "info";
}

export function pushLines(
  lines: CliOutputLine[],
  text: string,
  kind: CliStreamKind,
): void {
  for (const line of text.split("\n")) {
    lines.push({ kind, text: line });
  }
}

export function formatCliOutput(lines: CliOutputLine[]): string {
  if (lines.length === 0) {
    return "";
  }
  return `${lines.map((line) => line.text).join("\n")}\n`;
}

export function streamForKind(kind: CliStreamKind): "stdout" | "stderr" {
  return kind === "error" || kind === "warning" ? "stderr" : "stdout";
}

export function shouldUseColor(
  stream: { isTTY?: boolean },
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.NO_COLOR) {
    return false;
  }
  if (env.FORCE_COLOR === "0") {
    return false;
  }
  if (env.FORCE_COLOR) {
    return true;
  }
  return Boolean(stream.isTTY);
}

export function colorizeLine(
  kind: CliStreamKind,
  text: string,
  enabled: boolean,
): string {
  if (!enabled || kind === "info") {
    return text;
  }
  return `${ANSI[kind]}${text}${RESET}`;
}

export function writeCliOutput(
  lines: CliOutputLine[],
  io?: {
    stdout?: CliWriteStream;
    stderr?: CliWriteStream;
    env?: NodeJS.ProcessEnv;
  },
): void {
  const stdout = io?.stdout ?? process.stdout;
  const stderr = io?.stderr ?? process.stderr;
  const env = io?.env ?? process.env;
  for (const line of lines) {
    const stream = streamForKind(line.kind) === "stderr" ? stderr : stdout;
    const enabled = shouldUseColor(stream, env);
    stream.write(`${colorizeLine(line.kind, line.text, enabled)}\n`);
  }
}
