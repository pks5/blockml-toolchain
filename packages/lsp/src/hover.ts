import type { DocumentationProseEntry } from "@blockml/bom";
import { hitAt, memberTypeFqn } from "./hit-test.js";
import type { LspPosition, LspRange } from "./positions.js";
import type { WorkspaceState } from "./workspace.js";

export interface MarkupContent {
  kind: "markdown";
  value: string;
}

export interface HoverInfo {
  contents: MarkupContent;
  range: LspRange;
}

function firstProse(entries: DocumentationProseEntry[] | undefined): string | undefined {
  const text = entries?.[0]?.text?.trim();
  return text ? text : undefined;
}

function typeMarkdown(
  fqn: string,
  isText: string | undefined,
  documentations: DocumentationProseEntry[] | undefined,
  summaries: DocumentationProseEntry[] | undefined,
): string {
  const lines = [`**${fqn}**`];
  if (isText) {
    lines.push(isText);
  }
  const prose = firstProse(documentations) ?? firstProse(summaries);
  if (prose) {
    lines.push("", prose);
  }
  return lines.join("\n");
}

export function hoverAt(
  text: string,
  filePath: string,
  position: LspPosition,
  workspace: WorkspaceState,
): HoverInfo | null {
  const hit = hitAt(text, filePath, position);
  if (!hit) {
    return null;
  }

  let markdown: string;
  if (hit.kind === "member") {
    const lines = [`**${hit.member.name}**`, `\`${hit.member.kind}\``];
    const typeFqn = hit.typeFqn ?? memberTypeFqn(hit.member);
    if (typeFqn) {
      lines.push(`type: \`${typeFqn}\``);
    }
    const prose = firstProse(hit.member.documentations) ?? firstProse(hit.member.summaries);
    if (prose) {
      lines.push("", prose);
    }
    markdown = lines.join("\n");
  } else if (hit.kind === "type") {
    markdown = typeMarkdown(
      hit.fqn,
      hit.block.is,
      hit.block.documentations,
      hit.block.summaries,
    );
  } else {
    const registered = workspace.registry.get(hit.fqn)?.block;
    if (hit.fqn === hit.block.type) {
      markdown = typeMarkdown(
        hit.fqn,
        registered?.is ?? hit.block.is,
        registered?.documentations ?? hit.block.documentations,
        registered?.summaries ?? hit.block.summaries,
      );
    } else {
      markdown = typeMarkdown(
        hit.fqn,
        registered?.is,
        registered?.documentations,
        registered?.summaries,
      );
    }
  }

  return {
    contents: { kind: "markdown", value: markdown },
    range: hit.range,
  };
}
