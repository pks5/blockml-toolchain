import type { BlockDefinition, MemberDefinition } from "@blockml/bom";
import {
  escapeHtml,
  fqnToHtmlPath,
  fqnToPackagePrefix,
  packageIndexPath,
  relativePath,
} from "./fqn-path.js";
import type { BlockDocOptions } from "./options.js";
import { renderCompositionGroup } from "./composition-render.js";
import { renderTypeExpression, renderTypeRef } from "./type-links.js";

const PAGE_CSS = `
body { font-family: system-ui, sans-serif; margin: 2rem; line-height: 1.5; max-width: 960px; }
nav.breadcrumb { color: #555; margin-bottom: 1.5rem; font-size: 0.9rem; }
h1 { margin-bottom: 0.25rem; }
.meta { color: #444; margin-bottom: 1.5rem; }
.meta dt { font-weight: 600; display: inline; }
.meta dd { display: inline; margin: 0 1rem 0 0.25rem; }
section { margin-top: 1.5rem; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #ccc; padding: 0.4rem 0.6rem; text-align: left; }
th { background: #f5f5f5; }
a { color: #0366d6; }
`.trim();

function renderMemberType(
  member: MemberDefinition,
  pagePath: string,
  options: Required<BlockDocOptions>,
  knownFqns: Set<string>,
): string {
  if (member.kind === "property") {
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
    return renderTypeExpression(member.type, pagePath, options, knownFqns);
  }
  return "—";
}

function proseSection(title: string, entries: { text: string }[] | undefined): string {
  if (!entries?.length) {
    return "";
  }
  const items = entries.map((e) => `<p>${escapeHtml(e.text)}</p>`).join("\n");
  return `<section><h2>${escapeHtml(title)}</h2>${items}</section>`;
}

function renderBreadcrumb(
  fqn: string,
  pagePath: string,
  options: Required<BlockDocOptions>,
  rootIndexPath: string,
): string {
  const parts = [
    `<a href="${relativePath(pagePath, rootIndexPath)}">Index</a>`,
  ];
  if (options.outLayout === "fqn") {
    const pkg = fqnToPackagePrefix(fqn);
    const segments = pkg.split(".");
    for (let i = 1; i <= segments.length; i++) {
      const prefix = segments.slice(0, i).join(".");
      const href = relativePath(pagePath, packageIndexPath(prefix));
      parts.push(`<a href="${href}">${escapeHtml(prefix)}</a>`);
    }
  }
  parts.push(escapeHtml(fqn));
  return parts.join(" / ");
}

function collectCompositionGroups(block: BlockDefinition): Array<{
  aggregationName: string;
  composition: BlockDefinition["compositions"][number];
}> {
  const groups: Array<{
    aggregationName: string;
    composition: BlockDefinition["compositions"][number];
  }> = [];
  const seen = new Set<string>();

  for (const composition of block.compositions) {
    if (!seen.has(composition.aggregationName)) {
      seen.add(composition.aggregationName);
      groups.push({
        aggregationName: composition.aggregationName,
        composition,
      });
    }
  }

  for (const member of block.members) {
    if (member.kind === "aggregation" && member.composition) {
      if (!seen.has(member.name)) {
        seen.add(member.name);
        groups.push({
          aggregationName: member.name,
          composition: member.composition,
        });
      }
    }
  }

  return groups;
}

export function renderBlockPage(
  block: BlockDefinition,
  options: Required<BlockDocOptions>,
  rootIndexPath: string,
  knownFqns: Set<string>,
): string {
  const pagePath = fqnToHtmlPath(block.type, options.outLayout);

  const memberRows = block.members
    .map(
      (m) =>
        `<tr><td>${escapeHtml(m.kind)}</td><td>${escapeHtml(m.name)}</td><td>${renderMemberType(m, pagePath, options, knownFqns)}</td></tr>`,
    )
    .join("\n");

  const subBlockLinks = block.subBlocks
    .map((sub) => {
      const href = relativePath(pagePath, fqnToHtmlPath(sub.type, options.outLayout));
      return `<li><a href="${href}">${escapeHtml(sub.type)}</a> — ${escapeHtml(sub.name)}</li>`;
    })
    .join("\n");

  const refLinks = block.references
    ?.map((ref) => {
      const target = ref.type ?? ref.url ?? ref.file ?? "";
      if (!target) {
        return `<li>${escapeHtml(ref.context)}</li>`;
      }
      if (ref.type) {
        const href = relativePath(pagePath, fqnToHtmlPath(ref.type, options.outLayout));
        return `<li><a href="${href}">${escapeHtml(ref.type)}</a> — ${escapeHtml(ref.context)}</li>`;
      }
      return `<li>${escapeHtml(target)} — ${escapeHtml(ref.context)}</li>`;
    })
    .join("\n");

  const compositionSections = collectCompositionGroups(block)
    .map((group) =>
      renderCompositionGroup(
        group.aggregationName,
        group.composition,
        pagePath,
        options,
        knownFqns,
      ),
    )
    .filter(Boolean)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(block.type)}</title>
  <style>${PAGE_CSS}</style>
</head>
<body>
  <nav class="breadcrumb">${renderBreadcrumb(block.type, pagePath, options, rootIndexPath)}</nav>
  <h1>${escapeHtml(block.name)}</h1>
  <dl class="meta">
    <dt>FQN</dt><dd>${escapeHtml(block.type)}</dd>
    ${block.baseType ? `<dt>baseType</dt><dd>${renderTypeRef(block.baseType, pagePath, options, knownFqns)}</dd>` : ""}
    ${block.version ? `<dt>version</dt><dd>${escapeHtml(block.version)}</dd>` : ""}
    <dt>is</dt><dd>${escapeHtml(block.is ?? "")}</dd>
  </dl>
  ${proseSection("Documentation", block.documentations)}
  ${
    memberRows
      ? `<section><h2>Members</h2><table><thead><tr><th>Kind</th><th>Name</th><th>Type</th></tr></thead><tbody>${memberRows}</tbody></table></section>`
      : ""
  }
  ${compositionSections ? `<section><h2>Composition</h2>${compositionSections}</section>` : ""}
  ${subBlockLinks ? `<section><h2>Sub-Blocks</h2><ul>${subBlockLinks}</ul></section>` : ""}
  ${refLinks ? `<section><h2>References</h2><ul>${refLinks}</ul></section>` : ""}
</body>
</html>`;
}

export function renderIndexPage(
  title: string,
  fqns: string[],
  options: Required<BlockDocOptions>,
  indexPath: string,
): string {
  const byPackage = new Map<string, string[]>();
  for (const fqn of [...fqns].sort()) {
    const pkg = fqnToPackagePrefix(fqn);
    const list = byPackage.get(pkg) ?? [];
    list.push(fqn);
    byPackage.set(pkg, list);
  }

  const sections = [...byPackage.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([pkg, blocks]) => {
      const heading =
        options.outLayout === "fqn"
          ? `<h2><a href="${relativePath(indexPath, packageIndexPath(pkg))}">${escapeHtml(pkg)}</a></h2>`
          : `<h2>${escapeHtml(pkg)}</h2>`;
      const links = blocks
        .map((fqn) => {
          const href = relativePath(indexPath, fqnToHtmlPath(fqn, options.outLayout));
          return `<li><a href="${href}">${escapeHtml(fqn)}</a></li>`;
        })
        .join("\n");
      return `<section>${heading}<ul>${links}</ul></section>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>${PAGE_CSS}</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${fqns.length} block(s) in scope.</p>
  ${sections}
</body>
</html>`;
}
