import type { BlockDefinition, MemberDefinition, SourceLocation } from "@blockml/bom";
import { parse } from "@blockml/parser";
import { bomLocationToRange, type LspPosition, type LspRange } from "./positions.js";

export interface TypeHit {
  kind: "type";
  fqn: string;
  block: BlockDefinition;
  range: LspRange;
}

export interface TypeRefHit {
  kind: "typeRef";
  fqn: string;
  block: BlockDefinition;
  range: LspRange;
}

export interface MemberHit {
  kind: "member";
  member: MemberDefinition;
  range: LspRange;
  typeFqn?: string;
}

export type Hit = TypeHit | TypeRefHit | MemberHit;

export function memberTypeFqn(member: MemberDefinition): string | undefined {
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

export function navigationFqn(hit: Hit): string | undefined {
  if (hit.kind === "member") {
    return hit.typeFqn;
  }
  return hit.fqn;
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

function collectHits(block: BlockDefinition, text: string, out: Hit[]): void {
  const rangeOf = (loc: SourceLocation | undefined): LspRange | undefined => {
    if (!loc) {
      return undefined;
    }
    return bomLocationToRange(loc, text);
  };

  const sourceRange = rangeOf(block.source);
  if (sourceRange && block.type) {
    out.push({ kind: "type", fqn: block.type, block, range: sourceRange });
  }

  const typeRange = rangeOf(block.typeSource);
  if (typeRange && block.type) {
    out.push({ kind: "typeRef", fqn: block.type, block, range: typeRange });
  }

  const baseRange = rangeOf(block.baseTypeSource);
  if (baseRange && block.baseType) {
    out.push({ kind: "typeRef", fqn: block.baseType, block, range: baseRange });
  }

  for (const member of block.members) {
    const memberRange = rangeOf(member.source);
    if (!memberRange) {
      continue;
    }
    const hit: MemberHit = {
      kind: "member",
      member,
      range: memberRange,
    };
    const typeFqn = memberTypeFqn(member);
    if (typeFqn) {
      hit.typeFqn = typeFqn;
    }
    out.push(hit);
  }

  for (const sub of block.subBlocks) {
    collectHits(sub, text, out);
  }
  for (const embedded of block.embeddedBlocks) {
    collectHits(embedded, text, out);
  }
}

export function hitAt(text: string, filePath: string, position: LspPosition): Hit | null {
  const parseResult = parse(text, { filePath, continueOnError: true });
  if (!parseResult.document) {
    return null;
  }

  const hits: Hit[] = [];
  collectHits(parseResult.document.block, text, hits);

  let best: Hit | undefined;
  for (const candidate of hits) {
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

  return best ?? null;
}
