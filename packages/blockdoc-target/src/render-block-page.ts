import type { BlockDefinition, MemberDefinition } from "@blockml/bom";
import { escapeHtml, fqnToHtmlPath, relativePath } from "./fqn-path.js";
import type { BlockDocOptions } from "./options.js";

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

function memberTypeSummary(member: MemberDefinition): string {
  if (member.kind === "property") {
    return member.typeFqn ?? member.type?.kind ?? "—";
  }
  if (member.kind === "aggregation" || member.kind === "association") {
    return member.type?.kind ?? member.kind;
  }
  if (member.kind === "capability") {
    return member.typeFqn ?? "capability";
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

export function renderBlockPage(
  block: BlockDefinition,
  options: Required<BlockDocOptions>,
  indexPath: string,
): string {
  const pagePath = fqnToHtmlPath(block.type, options.outLayout);
  const homeLink = relativePath(pagePath, "index.html");

  const memberRows = block.members
    .map(
      (m) =>
        `<tr><td>${escapeHtml(m.kind)}</td><td>${escapeHtml(m.name)}</td><td>${escapeHtml(memberTypeSummary(m))}</td></tr>`,
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

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(block.type)}</title>
  <style>${PAGE_CSS}</style>
</head>
<body>
  <nav class="breadcrumb"><a href="${homeLink}">Index</a> / ${escapeHtml(block.type)}</nav>
  <h1>${escapeHtml(block.name)}</h1>
  <dl class="meta">
    <dt>FQN</dt><dd>${escapeHtml(block.type)}</dd>
    ${block.baseType ? `<dt>baseType</dt><dd>${escapeHtml(block.baseType)}</dd>` : ""}
    ${block.version ? `<dt>version</dt><dd>${escapeHtml(block.version)}</dd>` : ""}
    <dt>is</dt><dd>${escapeHtml(block.is ?? "")}</dd>
  </dl>
  ${proseSection("Documentation", block.documentations)}
  ${
    memberRows
      ? `<section><h2>Members</h2><table><thead><tr><th>Kind</th><th>Name</th><th>Type</th></tr></thead><tbody>${memberRows}</tbody></table></section>`
      : ""
  }
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
    const pkg = fqn.includes(".") ? fqn.split(".").slice(0, -1).join(".") : fqn;
    const list = byPackage.get(pkg) ?? [];
    list.push(fqn);
    byPackage.set(pkg, list);
  }

  const sections = [...byPackage.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([pkg, blocks]) => {
      const links = blocks
        .map((fqn) => {
          const href = relativePath(indexPath, fqnToHtmlPath(fqn, options.outLayout));
          return `<li><a href="${href}">${escapeHtml(fqn)}</a></li>`;
        })
        .join("\n");
      return `<section><h2>${escapeHtml(pkg)}</h2><ul>${links}</ul></section>`;
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
