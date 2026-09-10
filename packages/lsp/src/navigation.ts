import { pathToFileURL } from "node:url";
import type { BlockDefinition, SourceLocation } from "@blockml/bom";
import { hitAt, memberTypeFqn, navigationFqn } from "./hit-test.js";
import { bomLocationToRange, type LspPosition, type LspRange } from "./positions.js";
import { workspaceForOpenText, type WorkspaceState } from "./workspace.js";

export interface LspLocation {
  uri: string;
  range: LspRange;
}

export interface LspLocationLink {
  originSelectionRange: LspRange;
  target: LspLocation;
}

function locationFromSource(loc: SourceLocation): LspLocation | undefined {
  if (!loc.file) {
    return undefined;
  }
  return {
    uri: pathToFileURL(loc.file).href,
    range: bomLocationToRange(loc),
  };
}

function definitionLocation(workspace: WorkspaceState, fqn: string): LspLocation | undefined {
  const source = workspace.registry.get(fqn)?.block.source;
  return source ? locationFromSource(source) : undefined;
}

export function definitionAt(
  text: string,
  filePath: string,
  position: LspPosition,
  workspace: WorkspaceState,
): LspLocationLink[] | null {
  const scoped = workspaceForOpenText(workspace, text, filePath);
  const hit = hitAt(text, filePath, position, scoped);
  if (!hit) {
    return null;
  }
  if (hit.kind === "member") {
    if (!hit.definitionSource) {
      return null;
    }
    const target = locationFromSource(hit.definitionSource);
    if (!target) {
      return null;
    }
    return [{ originSelectionRange: hit.range, target }];
  }
  if (hit.kind !== "typeRef") {
    return null;
  }
  const fqn = navigationFqn(hit);
  if (!fqn) {
    return null;
  }
  const target = definitionLocation(scoped, fqn);
  if (!target) {
    return null;
  }
  return [{ originSelectionRange: hit.range, target }];
}

function pushLocation(out: LspLocation[], loc: SourceLocation | undefined): void {
  const location = loc ? locationFromSource(loc) : undefined;
  if (location) {
    out.push(location);
  }
}

function collectUsages(
  block: BlockDefinition,
  fqn: string,
  includeDeclaration: boolean,
  out: LspLocation[],
): void {
  if (includeDeclaration && block.type === fqn) {
    pushLocation(out, block.source);
  }
  if (block.baseType === fqn) {
    pushLocation(out, block.baseTypeSource);
  }
  for (const member of block.members) {
    if (memberTypeFqn(member) === fqn) {
      pushLocation(out, member.source);
    }
  }
}

export function referencesAt(
  text: string,
  filePath: string,
  position: LspPosition,
  workspace: WorkspaceState,
  includeDeclaration = true,
): LspLocation[] | null {
  const scoped = workspaceForOpenText(workspace, text, filePath);
  const hit = hitAt(text, filePath, position, scoped);
  if (!hit) {
    return null;
  }
  const fqn = navigationFqn(hit);
  if (!fqn) {
    return null;
  }

  const out: LspLocation[] = [];
  for (const key of scoped.registry.keys()) {
    const doc = scoped.registry.get(key);
    if (!doc) {
      continue;
    }
    collectUsages(doc.block, fqn, includeDeclaration, out);
  }
  return out;
}
