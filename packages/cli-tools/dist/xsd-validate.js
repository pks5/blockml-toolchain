import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
const BML_DOCUMENT_NS = "http://blockml.org/bml";
function loadLibxmljs() {
    try {
        const require = createRequire(import.meta.url);
        return require("libxmljs2");
    }
    catch {
        return null;
    }
}
function xmllintAvailable() {
    try {
        execFileSync("xmllint", ["--version"], { stdio: "ignore" });
        return true;
    }
    catch {
        return false;
    }
}
function diagnostic(severity, code, message, file, line = 1, column = 1) {
    return {
        severity,
        code,
        message,
        source: { file, line, column },
    };
}
/** Parse OASIS catalog uri entries: name (namespace) → uri (relative path). */
export function parseCatalogUriEntries(catalogXml) {
    const entries = new Map();
    const tagRegex = /<uri\b([^>]*)\/?>/g;
    let match;
    while ((match = tagRegex.exec(catalogXml)) !== null) {
        const attrs = match[1] ?? "";
        const name = attrs.match(/\bname="([^"]+)"/)?.[1];
        const uri = attrs.match(/\buri="([^"]+)"/)?.[1];
        if (name && uri) {
            entries.set(name, uri);
        }
    }
    return entries;
}
export function resolveBmlSchemaPath(rootDir) {
    const catalogPath = join(rootDir, "catalog.xml");
    if (existsSync(catalogPath)) {
        const catalog = readFileSync(catalogPath, "utf8");
        const rel = parseCatalogUriEntries(catalog).get(BML_DOCUMENT_NS);
        if (rel) {
            const normalized = rel.replace(/^\.\//, "");
            const fromCatalog = resolve(rootDir, normalized);
            if (existsSync(fromCatalog)) {
                return fromCatalog;
            }
        }
    }
    const fallback = join(rootDir, "schemas", "bml.xsd");
    if (existsSync(fallback)) {
        return fallback;
    }
    return null;
}
export function collectRegistryFilePaths(registry) {
    const paths = new Set();
    for (const fqn of registry.keys()) {
        const doc = registry.get(fqn);
        const filePath = doc?.source?.filePath;
        if (filePath && filePath !== "<memory>" && filePath !== "<scope>") {
            paths.add(filePath);
        }
    }
    return [...paths];
}
function validateFileWithLibxmljs(libxmljs, xsdDoc, absPath) {
    let xmlContent;
    try {
        xmlContent = readFileSync(absPath, "utf8");
    }
    catch (e) {
        return [
            diagnostic("error", "BML_XSD_VALIDATION_ERROR", `Cannot read file for XSD validation: ${e instanceof Error ? e.message : String(e)}`, absPath),
        ];
    }
    let doc;
    try {
        doc = libxmljs.parseXml(xmlContent);
    }
    catch (e) {
        return [
            diagnostic("error", "BML_XSD_VALIDATION_ERROR", `Malformed XML for XSD validation: ${e instanceof Error ? e.message : String(e)}`, absPath),
        ];
    }
    const valid = doc.validate(xsdDoc);
    if (valid) {
        return [];
    }
    const errors = doc.validationErrors;
    if (errors.length === 0) {
        return [
            diagnostic("error", "BML_XSD_VALIDATION_ERROR", "Document failed XSD validation", absPath),
        ];
    }
    return errors.map((err) => diagnostic("error", "BML_XSD_VALIDATION_ERROR", err.message, absPath, err.line ?? 1, err.column ?? 1));
}
function validateFileWithXmllint(absPath, schemaPath) {
    try {
        execFileSync("xmllint", ["--noout", "--schema", schemaPath, absPath], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
        });
        return [];
    }
    catch (e) {
        const err = e;
        const output = String(err.stderr ?? err.stdout ?? "").trim();
        if (!output) {
            return [
                diagnostic("error", "BML_XSD_VALIDATION_ERROR", "Document failed XSD validation", absPath),
            ];
        }
        const diagnostics = [];
        for (const line of output.split("\n")) {
            if (!line || line.endsWith("fails to validate")) {
                continue;
            }
            const match = line.match(/^(.+?):(\d+):\s*(.*)$/);
            if (match) {
                diagnostics.push(diagnostic("error", "BML_XSD_VALIDATION_ERROR", match[3], match[1], Number.parseInt(match[2], 10)));
            }
            else {
                diagnostics.push(diagnostic("error", "BML_XSD_VALIDATION_ERROR", line, absPath));
            }
        }
        return diagnostics.length
            ? diagnostics
            : [
                diagnostic("error", "BML_XSD_VALIDATION_ERROR", "Document failed XSD validation", absPath),
            ];
    }
}
export function validateFilesAgainstXsd(filePaths, rootDir) {
    const schemaPath = resolveBmlSchemaPath(rootDir);
    if (!schemaPath) {
        return [
            diagnostic("warning", "BML_XSD_SCHEMAS_MISSING", "XSD schemas not found; skipping authoring XSD validation (run compile xsd or set xsdValidation: false)", join(rootDir, "catalog.xml")),
        ];
    }
    const libxmljs = loadLibxmljs();
    let xsdDoc;
    if (libxmljs) {
        try {
            const xsdContent = readFileSync(schemaPath, "utf8");
            xsdDoc = libxmljs.parseXml(xsdContent);
        }
        catch (e) {
            return [
                diagnostic("warning", "BML_XSD_SCHEMAS_MISSING", `Failed to load XSD schema: ${e instanceof Error ? e.message : String(e)}`, schemaPath),
            ];
        }
    }
    else if (!xmllintAvailable()) {
        return [
            diagnostic("warning", "BML_XSD_SCHEMAS_MISSING", "XSD validation engine unavailable (install libxmljs2 or xmllint); skipping authoring XSD validation", schemaPath),
        ];
    }
    const diagnostics = [];
    const uniquePaths = [...new Set(filePaths)];
    for (const filePath of uniquePaths) {
        const absPath = isAbsolute(filePath) ? filePath : resolve(rootDir, filePath);
        if (!existsSync(absPath)) {
            continue;
        }
        if (libxmljs && xsdDoc) {
            diagnostics.push(...validateFileWithLibxmljs(libxmljs, xsdDoc, absPath));
        }
        else {
            diagnostics.push(...validateFileWithXmllint(absPath, schemaPath));
        }
    }
    return diagnostics;
}
//# sourceMappingURL=xsd-validate.js.map