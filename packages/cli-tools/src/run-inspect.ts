import { inspectProject, type InspectResult } from "@blockml/inspect";
import { pushLines, type CliOutputLine } from "./cli-style.js";
import type { BomConfig } from "./load-config.js";
import { suggestMatchingFqn, unknownFqnMessage } from "./suggest-fqn.js";

export interface InspectCliArgs {
  inspectFqn?: string;
  json?: boolean;
  depth?: number;
  srcDir?: string;
  libraries?: string[];
}

export async function runInspect(
  parsed: InspectCliArgs,
  rootDir: string,
  config: BomConfig,
  lines: CliOutputLine[],
  usage: string,
): Promise<number> {
  const fqn = parsed.inspectFqn?.trim() ?? "";
  if (!fqn) {
    pushLines(lines, "Specify a Block FQN.", "error");
    pushLines(lines, usage, "info");
    return 2;
  }

  const result: InspectResult = inspectProject(fqn, {
    rootDir,
    ...(parsed.srcDir !== undefined || config.srcDir !== undefined
      ? { srcDir: parsed.srcDir ?? config.srcDir }
      : {}),
    ...(parsed.libraries !== undefined || config.libraries !== undefined
      ? { libraries: parsed.libraries ?? config.libraries }
      : {}),
    ...(parsed.depth !== undefined ? { depth: parsed.depth } : {}),
  });

  if (!result.blocks[fqn] && result.unresolved.includes(fqn)) {
    const suggestion = await suggestMatchingFqn(fqn, {
      rootDir,
      ...(parsed.srcDir !== undefined || config.srcDir !== undefined
        ? { srcDir: parsed.srcDir ?? config.srcDir }
        : {}),
      ...(parsed.libraries !== undefined || config.libraries !== undefined
        ? { libraries: parsed.libraries ?? config.libraries }
        : {}),
    });
    pushLines(lines, unknownFqnMessage(fqn, suggestion), "error");
    return 2;
  }

  pushLines(lines, JSON.stringify(result, null, 2), "info");
  return 0;
}
