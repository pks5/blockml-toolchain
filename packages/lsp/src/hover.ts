import type {
  BlockDefinition,
  DocumentationProseEntry,
  MemberDefinition,
  SourceLocation,
} from "@blockml/bom";
import { parse } from "@blockml/parser";
import { bomLocationToRange, type LspPosition, type LspRange } from "./positions.js";
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

function memberTypeFqn(member: MemberDefinition): string | undefined {
  switch (member.kind) {
    case "property":
    case "capability":
      return member.typeFqn || undefined;
    case "association":
      return member.type.kind === "named" ? member.type.fqn : undefined;
    case "aggregation":
      return member.type?.kind === "named" ? member.type.fqn : undefined;
  }
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

function memberMarkdown(member: MemberDefinition): string {
  const lines = [`**${member.name}**`, `\`${member.kind}\``];
  const typeFqn = memberTypeFqn(member);
  if (typeFqn) {
    lines.push(`type: \`${typeFqn}\``);
  }
  const prose = firstProse(member.documentations) ?? firstProse(member.summaries);
  if (prose) {
    lines.push("", prose);
  }
  return lines.join("\n");
}

function rangeContains(range: LspRange, position: LspPosition): boolean {
  if (position.line < range.start.line || position.line > range.end.line) {
    return false;
  }
  if (position.line === range.start.line && position.character < range.start.character) {
    return false;
  }
  if (position.line === range.end.line && position.character >= range.end.character) {
    return false;
  }
  return true;
}

function rangeArea(range: LspRange): number {
  return (range.end.line - range.start.line) * 1_000_000 + (range.end.character - range.start.character);
}

function isLaterStart(a: LspRange, b: LspRange): boolean {
  if (a.start.line !== b.start.line) {
    return a.start.line > b.start.line;
  }
  return a.start.character > b.start.character;
}

function collectTargets(
  block: BlockDefinition,
  workspace: WorkspaceState,
  text: string,
  out: Array<{ range: LspRange; markdown: string }>,
): void {
  const push = (loc: SourceLocation | undefined, markdown: string): void => {
    if (!loc) {
      return;
    }
    out.push({ range: bomLocationToRange(loc, text), markdown });
  };

  push(block.source, typeMarkdown(block.type, block.is, block.documentations, block.summaries));

  if (block.type) {
    const registered = workspace.registry.get(block.type)?.block;
    push(
      block.typeSource,
      typeMarkdown(
        block.type,
        registered?.is ?? block.is,
        registered?.documentations ?? block.documentations,
        registered?.summaries ?? block.summaries,
      ),
    );
  }

  if (block.baseType) {
    const registered = workspace.registry.get(block.baseType)?.block;
    push(
      block.baseTypeSource,
      typeMarkdown(
        block.baseType,
        registered?.is,
        registered?.documentations,
        registered?.summaries,
      ),
    );
  }

  for (const member of block.members) {
    if (member.source) {
      push(member.source, memberMarkdown(member));
    }
  }

  for (const sub of block.subBlocks) {
    collectTargets(sub, workspace, text, out);
  }
  for (const embedded of block.embeddedBlocks) {
    collectTargets(embedded, workspace, text, out);
  }
}

export function hoverAt(
  text: string,
  filePath: string,
  position: LspPosition,
  workspace: WorkspaceState,
): HoverInfo | null {
  const parseResult = parse(text, { filePath, continueOnError: true });
  if (!parseResult.document) {
    return null;
  }

  const scored: Array<{ range: LspRange; markdown: string }> = [];
  collectTargets(parseResult.document.block, workspace, text, scored);

  let best: { range: LspRange; markdown: string } | undefined;
  for (const candidate of scored) {
    if (!rangeContains(candidate.range, position)) {
      continue;
    }
    if (!best) {
      best = candidate;
      continue;
    }
    const area = rangeArea(candidate.range);
    const bestArea = rangeArea(best.range);
    if (area < bestArea || (area === bestArea && isLaterStart(candidate.range, best.range))) {
      best = candidate;
    }
  }

  if (!best) {
    return null;
  }

  return {
    contents: { kind: "markdown", value: best.markdown },
    range: best.range,
  };
}
