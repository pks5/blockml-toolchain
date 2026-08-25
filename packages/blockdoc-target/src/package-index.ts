import { escapeHtml, fqnToHtmlPath, fqnToPackagePrefix, packageIndexPath, relativePath } from "./fqn-path.js";
import { packageSegmentLabel } from "./navigation.js";
import type { BlockDocOptions } from "./options.js";
import { PAGE_SHELL_CSS, wrapHtmlDocument } from "./toolbar.js";

function directBlocks(packagePrefix: string, rootFqns: string[]): string[] {
  return rootFqns.filter((fqn) => fqnToPackagePrefix(fqn) === packagePrefix).sort();
}

function directSubPackages(packagePrefix: string, rootFqns: string[]): string[] {
  const prefixDot = `${packagePrefix}.`;
  const subs = new Set<string>();
  for (const fqn of rootFqns) {
    const pkg = fqnToPackagePrefix(fqn);
    if (!pkg.startsWith(prefixDot)) {
      continue;
    }
    const rest = pkg.slice(prefixDot.length);
    const firstSegment = rest.split(".")[0];
    if (firstSegment) {
      subs.add(`${prefixDot}${firstSegment}`);
    }
  }
  return [...subs].sort();
}

export function renderPackageIndexPage(
  packagePrefix: string,
  rootFqns: string[],
  options: Required<BlockDocOptions>,
  indexPath: string,
  rootIndexPath: string,
): string {
  const blocks = directBlocks(packagePrefix, rootFqns);
  const subPackages = directSubPackages(packagePrefix, rootFqns);

  const breadcrumbParts = [
    `<a href="${relativePath(indexPath, rootIndexPath)}">Index</a>`,
  ];
  const segments = packagePrefix.split(".");
  for (let i = 1; i <= segments.length; i++) {
    const prefix = segments.slice(0, i).join(".");
    const label = packageSegmentLabel(prefix);
    if (prefix === packagePrefix) {
      breadcrumbParts.push(escapeHtml(label));
    } else {
      breadcrumbParts.push(
        `<a href="${relativePath(indexPath, packageIndexPath(prefix))}">${escapeHtml(label)}</a>`,
      );
    }
  }

  const subPackageLinks = subPackages
    .map((pkg) => {
      const href = relativePath(indexPath, packageIndexPath(pkg));
      return `<li><a href="${href}">${escapeHtml(packageSegmentLabel(pkg))}</a></li>`;
    })
    .join("\n");

  const blockLinks = blocks
    .map((fqn) => {
      const href = relativePath(indexPath, fqnToHtmlPath(fqn, options.outLayout));
      const label = fqn.split(".").pop() ?? fqn;
      return `<li><a href="${href}">${escapeHtml(label)}</a></li>`;
    })
    .join("\n");

  const PAGE_CSS = `
${PAGE_SHELL_CSS}
nav.breadcrumb { color: #555; margin-bottom: 1.5rem; font-size: 0.9rem; }
h1 { margin-bottom: 0.25rem; }
section { margin-top: 1.5rem; }
ul { padding-left: 1.5rem; }
a { color: #0366d6; }
`.trim();

  return wrapHtmlDocument(
    packagePrefix,
    indexPath,
    rootIndexPath,
    PAGE_CSS,
    `<nav class="breadcrumb">${breadcrumbParts.join(" / ")}</nav>
  <h1>${escapeHtml(packageSegmentLabel(packagePrefix))}</h1>
  ${subPackageLinks ? `<section><h2>Sub-packages</h2><ul>${subPackageLinks}</ul></section>` : ""}
  ${blockLinks ? `<section><h2>Blocks</h2><ul>${blockLinks}</ul></section>` : ""}`,
  );
}
