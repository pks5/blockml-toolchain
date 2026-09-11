export function fqnToPackagePrefix(fqn) {
    const segments = fqn.split(".");
    return segments.length > 1 ? segments.slice(0, -1).join(".") : fqn;
}
function proseText(entries) {
    if (!entries?.length) {
        return "";
    }
    return entries
        .map((entry) => entry.text.trim())
        .filter(Boolean)
        .join("\n");
}
export function blockToSearchDocument(block, filePath) {
    const fqn = block.type?.trim();
    const name = block.name?.trim();
    if (!fqn || !name) {
        return undefined;
    }
    const aliases = (block.aliases ?? [])
        .map((alias) => alias.value?.trim())
        .filter((value) => Boolean(value));
    const keywords = (block.keywords ?? [])
        .map((keyword) => keyword.value?.trim())
        .filter((value) => Boolean(value));
    const documentation = [proseText(block.documentations), proseText(block.summaries)]
        .filter(Boolean)
        .join("\n");
    const document = {
        id: fqn,
        fqn,
        name,
        aliases,
        keywords,
        documentation,
        file: filePath,
        library: fqnToPackagePrefix(fqn),
        type: fqn,
    };
    if (block.baseType) {
        document.baseType = block.baseType;
    }
    if (block.is) {
        document.idea = block.is;
    }
    return document;
}
export function documentsFromRegistry(registry) {
    const documents = [];
    const seen = new Set();
    for (const fqn of registry.keys()) {
        const doc = registry.get(fqn);
        if (!doc?.block) {
            continue;
        }
        const mapped = blockToSearchDocument(doc.block, doc.source?.filePath ?? fqn);
        if (!mapped || seen.has(mapped.fqn)) {
            continue;
        }
        seen.add(mapped.fqn);
        documents.push(mapped);
    }
    documents.sort((a, b) => a.fqn.localeCompare(b.fqn));
    return documents;
}
//# sourceMappingURL=documents.js.map