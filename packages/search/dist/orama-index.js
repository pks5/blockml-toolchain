import { create, insertMultiple, search as oramaSearch } from "@orama/orama";
import { persist, restore } from "@orama/plugin-data-persistence";
import { DEFAULT_SEARCH_LIMIT, FIELD_BOOST } from "./types.js";
const SCHEMA = {
    id: "string",
    fqn: "string",
    fqnText: "string",
    name: "string",
    aliases: "string[]",
    keywords: "string[]",
    documentation: "string",
    file: "string",
    library: "string",
    type: "string",
    baseType: "string",
    idea: "string",
};
function toIndexed(document) {
    return {
        id: document.id,
        fqn: document.fqn,
        fqnText: document.fqn.replaceAll(".", " "),
        name: document.name,
        aliases: document.aliases,
        keywords: document.keywords,
        documentation: document.documentation,
        file: document.file,
        library: document.library ?? "",
        type: document.type ?? document.fqn,
        baseType: document.baseType ?? "",
        idea: document.idea ?? "",
    };
}
function hitToResult(hit) {
    const result = {
        fqn: hit.document.fqn,
        name: hit.document.name,
        file: hit.document.file,
        score: hit.score,
    };
    if (hit.document.library) {
        result.library = hit.document.library;
    }
    return result;
}
function compareResults(a, b) {
    return b.score - a.score || a.fqn.localeCompare(b.fqn);
}
function uniqueFilePaths(documents) {
    return [...new Set(documents.map((document) => document.file).filter(Boolean))].sort();
}
export class SearchIndex {
    diagnostics;
    documents;
    filePaths;
    db;
    constructor(db, documents, filePaths, diagnostics = []) {
        this.db = db;
        this.documents = documents;
        this.filePaths = filePaths;
        this.diagnostics = diagnostics;
    }
    async search(query, options) {
        const term = query.trim();
        if (!term) {
            return [];
        }
        const result = await oramaSearch(this.db, {
            term,
            limit: options?.limit ?? DEFAULT_SEARCH_LIMIT,
            boost: { ...FIELD_BOOST },
            properties: ["fqn", "fqnText", "name", "aliases", "keywords", "documentation"],
        });
        const hits = result.hits;
        return hits.map((hit) => hitToResult(hit)).sort(compareResults);
    }
    async serialize() {
        const payload = await persist(this.db, "json");
        return typeof payload === "string" ? payload : String(payload);
    }
}
export async function createSearchIndex(documents, diagnostics = []) {
    const db = await create({ schema: SCHEMA });
    if (documents.length > 0) {
        await insertMultiple(db, documents.map((document) => toIndexed(document)));
    }
    return new SearchIndex(db, documents.length, uniqueFilePaths(documents), diagnostics);
}
export async function restoreSearchIndex(serialized, documents, filePaths, diagnostics = []) {
    const db = await restore("json", serialized);
    return new SearchIndex(db, documents, filePaths, diagnostics);
}
//# sourceMappingURL=orama-index.js.map