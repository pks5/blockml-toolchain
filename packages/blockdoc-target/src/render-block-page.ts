import type { BlockDefinition } from "@blockml/bom";
import type { TypeRegistry } from "@blockml/framework";
import {
  escapeHtml,
  fqnToHtmlPath,
  fqnToPackagePrefix,
  packageIndexPath,
  relativePath,
} from "./fqn-path.js";
import {
  collectLibraryPrefixes,
  libraryGroupLabel,
  owningLibraryPrefix,
  packageSegmentLabel,
  renderDottedPackagePath,
  type SiteNav,
} from "./navigation.js";
import type { BlockDocOptions } from "./options.js";
import { renderCompositionGroup } from "./composition-render.js";
import { renderMemberTable } from "./member-sections.js";
import { PAGE_SHELL_CSS, wrapHtmlDocument } from "./toolbar.js";
import { renderTypeRef } from "./type-links.js";

const PAGE_CSS = `
${PAGE_SHELL_CSS}
.package-fqn { color: #666; font-size: 0.85rem; margin: 0 0 0.25rem; }
.extends { color: #666; font-size: 0.85rem; margin: 0.25rem 0 0.75rem; }
.version { color: #666; font-size: 0.85rem; margin: 0 0 0.75rem; }
h1 { margin: 0 0 0.25rem; }
h2.designation { font-size: 1.15rem; font-weight: 500; color: #333; margin: 0 0 1.5rem; }
section { margin-top: 1.5rem; }
section.library { margin-top: 2.25rem; }
section.library > h2 { font-size: 1.35rem; margin: 0 0 0.15rem; }
section.library .library-prefix { color: #666; font-size: 0.85rem; margin: 0 0 0.75rem; }
section.library section { margin-top: 1rem; }
section.library h3 { font-size: 1.05rem; margin: 0 0 0.4rem; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #ccc; padding: 0.4rem 0.6rem; text-align: left; }
th { background: #f5f5f5; }
a { color: #0366d6; }
`.trim();

function renderBlockHeader(
  block: BlockDefinition,
  pagePath: string,
  options: Required<BlockDocOptions>,
  knownFqns: Set<string>,
): string {
  const packageFqn = fqnToPackagePrefix(block.type);
  const packagePath =
    options.outLayout === "fqn"
      ? renderDottedPackagePath(packageFqn, pagePath, options, knownFqns)
      : escapeHtml(packageFqn);
  const extendsLine = block.baseType
    ? `<p class="extends">extends ${renderTypeRef(block.baseType, pagePath, options, knownFqns)}</p>`
    : "";

  const versionLine = block.version
    ? `<p class="version">${escapeHtml(block.version)}</p>`
    : "";

  const designationLine = block.is
    ? `<h2 class="designation">${escapeHtml(block.is)}</h2>`
    : "";

  return `<p class="package-fqn">${packagePath}</p>
  <h1>${escapeHtml(block.name)}</h1>
  ${extendsLine}${versionLine}${designationLine}`;
}

function renderMemberSections(
  block: BlockDefinition,
  pagePath: string,
  options: Required<BlockDocOptions>,
  knownFqns: Set<string>,
  registry?: TypeRegistry,
): string {
  const properties = block.members.filter((m) => m.kind === "property");
  const aggregations = block.members.filter((m) => m.kind === "aggregation");
  const associations = block.members.filter((m) => m.kind === "association");
  const capabilities = block.members.filter((m) => m.kind === "capability");

  return [
    renderMemberTable("Properties", properties, block, pagePath, options, knownFqns, registry),
    renderMemberTable("Aggregations", aggregations, block, pagePath, options, knownFqns, registry),
    renderMemberTable("Associations", associations, block, pagePath, options, knownFqns, registry),
    renderMemberTable("Capabilities", capabilities, block, pagePath, options, knownFqns, registry),
  ]
    .filter(Boolean)
    .join("\n");
}

function proseSection(title: string, entries: { text: string }[] | undefined): string {
  if (!entries?.length) {
    return "";
  }
  const items = entries.map((e) => `<p>${escapeHtml(e.text)}</p>`).join("\n");
  return `<section><h2>${escapeHtml(title)}</h2>${items}</section>`;
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
  nav: SiteNav,
  knownFqns: Set<string>,
  _rootFqn: string,
  registry?: TypeRegistry,
): string {
  const pagePath = fqnToHtmlPath(block.type, options.outLayout);

  const memberSections = renderMemberSections(block, pagePath, options, knownFqns, registry);

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

  return wrapHtmlDocument(
    block.type,
    pagePath,
    nav,
    PAGE_CSS,
    `${renderBlockHeader(block, pagePath, options, knownFqns)}
  ${proseSection("Documentation", block.documentations)}
  ${memberSections}
  ${compositionSections ? `<section><h2>Composition</h2>${compositionSections}</section>` : ""}
  ${subBlockLinks ? `<section><h2>Sub-Blocks</h2><ul>${subBlockLinks}</ul></section>` : ""}
  ${refLinks ? `<section><h2>References</h2><ul>${refLinks}</ul></section>` : ""}`,
  );
}

function groupRootFqnsByPackage(rootFqns: string[]): Map<string, string[]> {
  const byPackage = new Map<string, string[]>();
  for (const fqn of [...rootFqns].sort()) {
    const pkg = fqnToPackagePrefix(fqn);
    const list = byPackage.get(pkg) ?? [];
    list.push(fqn);
    byPackage.set(pkg, list);
  }
  return byPackage;
}

function renderBlockList(
  blocks: string[],
  options: Required<BlockDocOptions>,
  indexPath: string,
): string {
  const links = blocks
    .map((fqn) => {
      const href = relativePath(indexPath, fqnToHtmlPath(fqn, options.outLayout));
      const label = fqn.split(".").pop() ?? fqn;
      return `<li><a href="${href}">${escapeHtml(label)}</a></li>`;
    })
    .join("\n");
  return `<ul>${links}</ul>`;
}

function renderPackageHeading(
  pkg: string,
  options: Required<BlockDocOptions>,
  indexPath: string,
  tag: "h2" | "h3",
): string {
  if (options.outLayout === "fqn") {
    const href = relativePath(indexPath, packageIndexPath(pkg));
    return `<${tag}><a href="${href}">${escapeHtml(packageSegmentLabel(pkg))}</a></${tag}>`;
  }
  return `<${tag}>${escapeHtml(pkg)}</${tag}>`;
}

function renderPackageSections(
  byPackage: Map<string, string[]>,
  options: Required<BlockDocOptions>,
  indexPath: string,
  headingTag: "h2" | "h3",
): string {
  return [...byPackage.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([pkg, blocks]) => {
      return `<section>${renderPackageHeading(pkg, options, indexPath, headingTag)}${renderBlockList(blocks, options, indexPath)}</section>`;
    })
    .join("\n");
}

function renderLibraryHeading(
  prefix: string,
  allPrefixes: string[],
  options: Required<BlockDocOptions>,
  indexPath: string,
): string {
  const label = libraryGroupLabel(prefix, allPrefixes);
  const heading =
    options.outLayout === "fqn"
      ? `<h2><a href="${relativePath(indexPath, packageIndexPath(prefix))}">${escapeHtml(label)}</a></h2>`
      : `<h2>${escapeHtml(label)}</h2>`;
  return `${heading}
  <p class="library-prefix">${escapeHtml(prefix)}</p>`;
}

function renderMultiLibrarySections(
  rootFqns: string[],
  libraryPrefixes: string[],
  options: Required<BlockDocOptions>,
  indexPath: string,
): string {
  const byLibrary = new Map<string, string[]>();
  const unmatched: string[] = [];
  for (const fqn of [...rootFqns].sort()) {
    const owner = owningLibraryPrefix(fqn, libraryPrefixes);
    if (!owner) {
      unmatched.push(fqn);
      continue;
    }
    const list = byLibrary.get(owner) ?? [];
    list.push(fqn);
    byLibrary.set(owner, list);
  }

  const librarySections = libraryPrefixes
    .filter((prefix) => byLibrary.has(prefix))
    .map((prefix) => {
      const fqns = byLibrary.get(prefix)!;
      const byPackage = groupRootFqnsByPackage(fqns);
      const rootBlocks = byPackage.get(prefix) ?? [];
      byPackage.delete(prefix);
      const inner = [
        rootBlocks.length > 0 ? renderBlockList(rootBlocks, options, indexPath) : "",
        renderPackageSections(byPackage, options, indexPath, "h3"),
      ]
        .filter(Boolean)
        .join("\n");
      return `<section class="library">${renderLibraryHeading(prefix, libraryPrefixes, options, indexPath)}
  ${inner}</section>`;
    })
    .join("\n");

  const other =
    unmatched.length > 0
      ? `<section class="library"><h2>Other</h2>
  ${renderPackageSections(groupRootFqnsByPackage(unmatched), options, indexPath, "h3")}</section>`
      : "";

  return [librarySections, other].filter(Boolean).join("\n");
}

export function renderIndexPage(
  title: string,
  rootFqns: string[],
  options: Required<BlockDocOptions>,
  indexPath: string,
  nav: SiteNav,
): string {
  const libraryPrefixes = collectLibraryPrefixes(rootFqns);
  const sections =
    libraryPrefixes.length >= 2
      ? renderMultiLibrarySections(rootFqns, libraryPrefixes, options, indexPath)
      : renderPackageSections(groupRootFqnsByPackage(rootFqns), options, indexPath, "h2");

  return wrapHtmlDocument(
    title,
    indexPath,
    nav,
    PAGE_CSS,
    `<h1>${escapeHtml(title)}</h1>
  <p>${rootFqns.length} block(s) in scope.</p>
  ${sections}`,
  );
}
