import type { DocumentationProseEntry, MemberDefinition } from "@blockml/bom";
import { hitAt, memberTypeFqn } from "./hit-test.js";
import type { LspPosition, LspRange } from "./positions.js";
import { workspaceForOpenText, type WorkspaceState } from "./workspace.js";

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

function memberMarkdown(member: MemberDefinition, typeFqn: string | undefined): string {
  const lines = [`**${member.name}**`, `\`${member.kind}\``];
  if (typeFqn) {
    lines.push(`type: \`${typeFqn}\``);
  }
  const prose = firstProse(member.documentations) ?? firstProse(member.summaries);
  if (prose) {
    lines.push("", prose);
  }
  return lines.join("\n");
}

function languageMarkdown(metaFqn: string, member: MemberDefinition | undefined, workspace: WorkspaceState): string {
  if (member) {
    const lines = [`**${member.name}**`, `\`${metaFqn}\` ${member.kind}`];
    const prose = firstProse(member.documentations) ?? firstProse(member.summaries);
    if (prose) {
      lines.push("", prose);
    }
    return lines.join("\n");
  }
  const registered = workspace.registry.get(metaFqn)?.block;
  return typeMarkdown(
    metaFqn,
    registered?.is,
    registered?.documentations,
    registered?.summaries,
  );
}

export function hoverAt(
  text: string,
  filePath: string,
  position: LspPosition,
  workspace: WorkspaceState,
): HoverInfo | null {
  const scoped = workspaceForOpenText(workspace, text, filePath);
  const hit = hitAt(text, filePath, position, scoped);
  if (!hit) {
    return null;
  }

  let markdown: string;
  if (hit.kind === "member") {
    markdown = memberMarkdown(hit.member, hit.typeFqn ?? memberTypeFqn(hit.member));
  } else if (hit.kind === "language") {
    markdown = languageMarkdown(hit.metaFqn, hit.member, scoped);
  } else {
    const registered = scoped.registry.get(hit.fqn)?.block;
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
