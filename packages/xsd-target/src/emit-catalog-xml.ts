export interface CatalogEntry {
  namespaceUri: string;
  relativePath: string;
}

export function catalogRelativePath(outDir: string, schemaFileName: string): string {
  const normalized = outDir.replace(/\\/g, "/").replace(/\/+$/, "");
  return `./${normalized}/${schemaFileName}`;
}

export function emitCatalogXml(entries: CatalogEntry[]): string {
  const uris = entries
    .map(
      (e) =>
        `  <uri\n    name="${e.namespaceUri}"\n    uri="${e.relativePath}"/>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<catalog xmlns="urn:oasis:names:tc:entity:xmlns:xml:catalog">
${uris}
</catalog>
`;
}
