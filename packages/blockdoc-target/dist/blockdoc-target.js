import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "@blockml/parser";
import { fqnToHtmlPath } from "./fqn-path.js";
import { renderBlockPage, renderIndexPage } from "./render-block-page.js";
import { resolveBlockDocOptions } from "./options.js";
function aggregationTypeFqns(block, aggregationName) {
    const agg = block.members.find((m) => m.kind === "aggregation" && m.name === aggregationName);
    if (!agg || agg.kind !== "aggregation" || !agg.composition) {
        return [];
    }
    return agg.composition.children
        .filter((c) => c.kind === "blockInstance")
        .map((c) => c.instance.typeFqn);
}
function collectExportedFqns(libraryPaths, rootDir) {
    const exported = new Set();
    for (const libPath of libraryPaths) {
        const abs = resolve(rootDir, libPath);
        let source;
        try {
            source = readFileSync(abs, "utf8");
        }
        catch {
            continue;
        }
        const parsed = parse(source, { filePath: abs, continueOnError: true });
        if (!parsed.document) {
            continue;
        }
        for (const fqn of aggregationTypeFqns(parsed.document.block, "blocks")) {
            exported.add(fqn);
        }
    }
    return exported;
}
function collectBlockFqns(ctx, request) {
    const options = resolveBlockDocOptions(request.targetOptions);
    const registry = ctx.session.typeRegistry;
    let fqns = registry.keys();
    if (!options.includeNonExported && ctx.session.libraryPaths?.length) {
        const rootDir = process.cwd();
        const exported = collectExportedFqns(ctx.session.libraryPaths, rootDir);
        fqns = fqns.filter((fqn) => exported.has(fqn));
    }
    return [...new Set(fqns)].sort();
}
function findBlock(root, fqn) {
    if (root.type === fqn) {
        return root;
    }
    for (const sub of root.subBlocks) {
        const found = findBlock(sub, fqn);
        if (found) {
            return found;
        }
    }
    return undefined;
}
export class BlockDocTarget {
    name = "blockdoc";
    accepts = ["library", "corpus", "auto"];
    render(request, ctx) {
        const options = resolveBlockDocOptions(request.targetOptions);
        const fqns = collectBlockFqns(ctx, request);
        const files = [];
        for (const fqn of fqns) {
            const doc = ctx.session.typeRegistry.get(fqn);
            if (!doc) {
                continue;
            }
            const block = doc.block.type === fqn ? doc.block : findBlock(doc.block, fqn);
            if (!block) {
                continue;
            }
            const pagePath = options.outLayout === "fqn"
                ? fqnToHtmlPath(fqn, "fqn")
                : fqnToHtmlPath(fqn, "package");
            files.push({
                path: pagePath,
                content: renderBlockPage(block, options, "index.html"),
            });
        }
        if (options.siteMode === "perLibrary" && ctx.session.libraryPaths?.length) {
            const rootDir = process.cwd();
            for (const libPath of ctx.session.libraryPaths) {
                const abs = resolve(rootDir, libPath);
                let source;
                try {
                    source = readFileSync(abs, "utf8");
                }
                catch {
                    continue;
                }
                const parsed = parse(source, { filePath: abs, continueOnError: true });
                const libFqn = parsed.document?.block.type;
                if (!libFqn) {
                    continue;
                }
                const prefix = libFqn.replace(/\.Library$/, "");
                const libFqns = fqns.filter((f) => f.startsWith(prefix + ".") || f === prefix);
                const indexPath = `${prefix.split(".").join("/")}/index.html`;
                files.push({
                    path: indexPath,
                    content: renderIndexPage(`${prefix} — BlockDoc`, libFqns, options, indexPath),
                });
            }
        }
        else {
            files.push({
                path: "index.html",
                content: renderIndexPage("BlockDoc", fqns, options, "index.html"),
            });
        }
        return { files };
    }
}
//# sourceMappingURL=blockdoc-target.js.map