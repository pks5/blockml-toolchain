import { escapeHtml, fqnToHtmlPath, fqnToPackagePrefix, packageIndexPath, relativePath } from "./fqn-path.js";
export function collectPackagePrefixes(fqns) {
    const prefixes = new Set();
    for (const fqn of fqns) {
        const pkg = fqnToPackagePrefix(fqn);
        const segments = pkg.split(".");
        for (let i = 1; i <= segments.length; i++) {
            prefixes.add(segments.slice(0, i).join("."));
        }
    }
    return [...prefixes].sort();
}
function directBlocks(packagePrefix, fqns) {
    return fqns.filter((fqn) => fqnToPackagePrefix(fqn) === packagePrefix).sort();
}
function directSubPackages(packagePrefix, fqns) {
    const prefixDot = `${packagePrefix}.`;
    const subs = new Set();
    for (const fqn of fqns) {
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
export function renderPackageIndexPage(packagePrefix, fqns, options, indexPath, rootIndexPath) {
    const blocks = directBlocks(packagePrefix, fqns);
    const subPackages = directSubPackages(packagePrefix, fqns);
    const breadcrumbParts = [
        `<a href="${relativePath(indexPath, rootIndexPath)}">Index</a>`,
    ];
    const segments = packagePrefix.split(".");
    for (let i = 1; i <= segments.length; i++) {
        const prefix = segments.slice(0, i).join(".");
        if (prefix === packagePrefix) {
            breadcrumbParts.push(escapeHtml(prefix));
        }
        else {
            breadcrumbParts.push(`<a href="${relativePath(indexPath, packageIndexPath(prefix))}">${escapeHtml(prefix)}</a>`);
        }
    }
    const subPackageLinks = subPackages
        .map((pkg) => {
        const href = relativePath(indexPath, packageIndexPath(pkg));
        return `<li><a href="${href}">${escapeHtml(pkg)}</a></li>`;
    })
        .join("\n");
    const blockLinks = blocks
        .map((fqn) => {
        const href = relativePath(indexPath, fqnToHtmlPath(fqn, options.outLayout));
        return `<li><a href="${href}">${escapeHtml(fqn)}</a></li>`;
    })
        .join("\n");
    const PAGE_CSS = `
body { font-family: system-ui, sans-serif; margin: 2rem; line-height: 1.5; max-width: 960px; }
nav.breadcrumb { color: #555; margin-bottom: 1.5rem; font-size: 0.9rem; }
h1 { margin-bottom: 0.25rem; }
section { margin-top: 1.5rem; }
ul { padding-left: 1.5rem; }
a { color: #0366d6; }
`.trim();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(packagePrefix)}</title>
  <style>${PAGE_CSS}</style>
</head>
<body>
  <nav class="breadcrumb">${breadcrumbParts.join(" / ")}</nav>
  <h1>${escapeHtml(packagePrefix)}</h1>
  ${subPackageLinks ? `<section><h2>Sub-packages</h2><ul>${subPackageLinks}</ul></section>` : ""}
  ${blockLinks ? `<section><h2>Blocks</h2><ul>${blockLinks}</ul></section>` : ""}
</body>
</html>`;
}
//# sourceMappingURL=package-index.js.map