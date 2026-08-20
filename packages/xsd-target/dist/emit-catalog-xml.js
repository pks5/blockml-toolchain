export function catalogRelativePath(outDir, schemaFileName) {
    const normalized = outDir.replace(/\\/g, "/").replace(/\/+$/, "");
    return `./${normalized}/${schemaFileName}`;
}
export function emitCatalogXml(entries) {
    const uris = entries
        .map((e) => `  <uri\n    name="${e.namespaceUri}"\n    uri="${e.relativePath}"/>`)
        .join("\n");
    return `<?xml version="1.0" encoding="UTF-8"?>
<catalog xmlns="urn:oasis:names:tc:entity:xmlns:xml:catalog">
${uris}
</catalog>
`;
}
//# sourceMappingURL=emit-catalog-xml.js.map