import type { BlockDefinition, MemberDefinition } from "@blockml/bom";
import { escapeHtml } from "./fqn-path.js";
import type { BlockDocOptions } from "./options.js";
import { renderTypeExpression, renderTypeRef } from "./type-links.js";

function simpleTypeName(typeFqn: string): string {
  const base = typeFqn.split("<")[0]?.split("[")[0] ?? typeFqn;
  const segments = base.split(".");
  return segments[segments.length - 1] ?? base;
}

export function resolveSubBlockTypeFqn(
  block: BlockDefinition,
  typeName: string | undefined,
): string | undefined {
  if (!typeName) {
    return undefined;
  }
  const simple = simpleTypeName(typeName);
  for (const sub of block.subBlocks) {
    if (sub.name === simple) {
      return sub.type;
    }
  }
  return undefined;
}

export function renderMemberTypeCell(
  member: MemberDefinition,
  block: BlockDefinition,
  pagePath: string,
  options: Required<BlockDocOptions>,
  knownFqns: Set<string>,
): string {
  if (member.kind === "property") {
    const subBlockFqn =
      resolveSubBlockTypeFqn(block, member.typeFqn) ??
      resolveSubBlockTypeFqn(block, member.type?.kind === "named" ? member.type.fqn : undefined);
    if (subBlockFqn) {
      return renderTypeRef(subBlockFqn, pagePath, options, knownFqns);
    }
    if (member.typeFqn) {
      return renderTypeRef(member.typeFqn, pagePath, options, knownFqns);
    }
    if (member.type) {
      return renderTypeExpression(member.type, pagePath, options, knownFqns);
    }
    return "—";
  }

  if (member.kind === "capability") {
    if (member.typeFqn) {
      return renderTypeRef(member.typeFqn, pagePath, options, knownFqns);
    }
    return "capability";
  }

  if (member.kind === "aggregation" || member.kind === "association") {
    if (member.type?.kind === "named") {
      const subBlockFqn = resolveSubBlockTypeFqn(block, member.type.fqn);
      if (subBlockFqn) {
        const suffix = member.type.multiplicity
          ? `[${member.type.multiplicity.min}..${member.type.multiplicity.max === "*" ? "*" : member.type.multiplicity.max}]`
          : "";
        return `${renderTypeRef(subBlockFqn, pagePath, options, knownFqns)}${suffix}`;
      }
    }
    return renderTypeExpression(member.type, pagePath, options, knownFqns);
  }

  return "—";
}

export function renderMemberTable(
  title: string,
  members: MemberDefinition[],
  block: BlockDefinition,
  pagePath: string,
  options: Required<BlockDocOptions>,
  knownFqns: Set<string>,
): string {
  if (!members.length) {
    return "";
  }
  const rows = members
    .map(
      (member) =>
        `<tr><td>${escapeHtml(member.name)}</td><td>${renderMemberTypeCell(member, block, pagePath, options, knownFqns)}</td></tr>`,
    )
    .join("\n");
  return `<section><h2>${title}</h2><table><thead><tr><th>Name</th><th>Type</th></tr></thead><tbody>${rows}</tbody></table></section>`;
}
