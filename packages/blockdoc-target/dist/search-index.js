const SEARCH_RESULT_LIMIT = 12;
export function collectKeywords(block) {
    const seen = new Set();
    const add = (value) => {
        const term = value?.trim();
        if (term) {
            seen.add(term);
        }
    };
    add(block.name);
    add(block.type);
    for (const segment of block.type.split(".")) {
        add(segment);
    }
    add(block.is);
    for (const alias of block.aliases ?? []) {
        add(alias.name);
        const aliasTail = alias.typeFqn.split(".").pop();
        add(aliasTail);
    }
    for (const keyword of block.keywords ?? []) {
        add(keyword.term);
        const keywordTail = keyword.typeFqn.split(".").pop();
        add(keywordTail);
    }
    return [...seen];
}
export function buildSearchIndexEntry(block, href) {
    const entry = {
        name: block.name,
        type: block.type,
        href,
        keywords: collectKeywords(block),
    };
    if (block.is) {
        entry.is = block.is;
    }
    return entry;
}
export function serializeSearchIndex(entries) {
    const index = { blocks: entries };
    return `${JSON.stringify(index, null, 2)}\n`;
}
function rank(query, entry) {
    const q = query.toLowerCase();
    const name = entry.name.toLowerCase();
    if (name === q) {
        return 0;
    }
    if (name.startsWith(q)) {
        return 1;
    }
    return 2;
}
export function filterSearchIndex(entries, query, limit = SEARCH_RESULT_LIMIT) {
    const trimmed = query.trim();
    if (!trimmed) {
        return [];
    }
    const tokens = trimmed.toLowerCase().split(/\s+/);
    const hits = entries.filter((entry) => tokens.every((token) => entry.keywords.some((keyword) => keyword.toLowerCase().includes(token))));
    hits.sort((a, b) => rank(trimmed, a) - rank(trimmed, b) || a.name.localeCompare(b.name));
    return hits.slice(0, limit);
}
//# sourceMappingURL=search-index.js.map