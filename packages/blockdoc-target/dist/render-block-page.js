import { escapeHtml, fqnToHtmlPath, fqnToPackagePrefix, packageIndexPath, relativePath, } from "./fqn-path.js";
import { packageSegmentLabel, renderDottedPackagePath } from "./navigation.js";
import { renderCompositionGroup } from "./composition-render.js";
import { renderMemberTable } from "./member-sections.js";
import { renderTypeRef } from "./type-links.js";
const PAGE_CSS = `
body { font-family: system-ui, sans-serif; margin: 2rem; line-height: 1.5; max-width: 960px; }
.site-index { font-size: 0.85rem; margin: 0 0 1rem; }
.package-fqn { color: #666; font-size: 0.85rem; margin: 0 0 0.25rem; }
.extends { color: #666; font-size: 0.85rem; margin: 0.25rem 0 0.75rem; }
.version { color: #666; font-size: 0.85rem; margin: 0 0 0.75rem; }
h1 { margin: 0 0 0.25rem; }
h2.designation { font-size: 1.15rem; font-weight: 500; color: #333; margin: 0 0 1.5rem; }
section { margin-top: 1.5rem; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #ccc; padding: 0.4rem 0.6rem; text-align: left; }
th { background: #f5f5f5; }
a { color: #0366d6; }
`.trim();
function renderBlockHeader(block, pagePath, options, knownFqns, rootIndexPath) {
    const packageFqn = fqnToPackagePrefix(block.type);
    const packagePath = options.outLayout === "fqn"
        ? renderDottedPackagePath(packageFqn, pagePath, options, knownFqns)
        : escapeHtml(packageFqn);
    const indexHref = relativePath(pagePath, rootIndexPath);
    const extendsLine = block.baseType
        ? `<p class="extends">extends ${renderTypeRef(block.baseType, pagePath, options, knownFqns)}</p>`
        : "";
    const versionLine = block.version
        ? `<p class="version">${escapeHtml(block.version)}</p>`
        : "";
    const designationLine = block.is
        ? `<h2 class="designation">${escapeHtml(block.is)}</h2>`
        : "";
    return `<p class="site-index"><a href="${indexHref}">Index</a></p>
  <p class="package-fqn">${packagePath}</p>
  <h1>${escapeHtml(block.name)}</h1>
  ${extendsLine}${versionLine}${designationLine}`;
}
function renderMemberSections(block, pagePath, options, knownFqns) {
    const properties = block.members.filter((m) => m.kind === "property");
    const aggregations = block.members.filter((m) => m.kind === "aggregation");
    const associations = block.members.filter((m) => m.kind === "association");
    const capabilities = block.members.filter((m) => m.kind === "capability");
    return [
        renderMemberTable("Properties", properties, block, pagePath, options, knownFqns),
        renderMemberTable("Aggregations", aggregations, block, pagePath, options, knownFqns),
        renderMemberTable("Associations", associations, block, pagePath, options, knownFqns),
        renderMemberTable("Capabilities", capabilities, block, pagePath, options, knownFqns),
    ]
        .filter(Boolean)
        .join("\n");
}
function proseSection(title, entries) {
    if (!entries?.length) {
        return "";
    }
    const items = entries.map((e) => `<p>${escapeHtml(e.text)}</p>`).join("\n");
    return `<section><h2>${escapeHtml(title)}</h2>${items}</section>`;
}
function collectCompositionGroups(block) {
    const groups = [];
    const seen = new Set();
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
export function renderBlockPage(block, options, rootIndexPath, knownFqns, _rootFqn) {
    const pagePath = fqnToHtmlPath(block.type, options.outLayout);
    const memberSections = renderMemberSections(block, pagePath, options, knownFqns);
    const subBlockLinks = block.subBlocks
        .map((sub) => {
        const href = relativePath(pagePath, fqnToHtmlPath(sub.type, options.outLayout));
        return `<li><a href="${href}">${escapeHtml(sub.name)}</a></li>`;
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
        .map((group) => renderCompositionGroup(group.aggregationName, group.composition, pagePath, options, knownFqns))
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
  ${renderBlockHeader(block, pagePath, options, knownFqns, rootIndexPath)}
  ${proseSection("Documentation", block.documentations)}
  ${memberSections}
  ${compositionSections ? `<section><h2>Composition</h2>${compositionSections}</section>` : ""}
  ${subBlockLinks ? `<section><h2>Sub-Blocks</h2><ul>${subBlockLinks}</ul></section>` : ""}
  ${refLinks ? `<section><h2>References</h2><ul>${refLinks}</ul></section>` : ""}
</body>
</html>`;
}
export function renderIndexPage(title, rootFqns, options, indexPath) {
    const byPackage = new Map();
    for (const fqn of [...rootFqns].sort()) {
        const pkg = fqnToPackagePrefix(fqn);
        const list = byPackage.get(pkg) ?? [];
        list.push(fqn);
        byPackage.set(pkg, list);
    }
    const sections = [...byPackage.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([pkg, blocks]) => {
        const heading = options.outLayout === "fqn"
            ? `<h2><a href="${relativePath(indexPath, packageIndexPath(pkg))}">${escapeHtml(packageSegmentLabel(pkg))}</a></h2>`
            : `<h2>${escapeHtml(pkg)}</h2>`;
        const links = blocks
            .map((fqn) => {
            const href = relativePath(indexPath, fqnToHtmlPath(fqn, options.outLayout));
            const label = fqn.split(".").pop() ?? fqn;
            return `<li><a href="${href}">${escapeHtml(label)}</a></li>`;
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
  <p>${rootFqns.length} block(s) in scope.</p>
  ${sections}
</body>
</html>`;
}
//# sourceMappingURL=render-block-page.js.map