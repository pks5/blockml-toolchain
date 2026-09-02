export const BML_XMLNS = "http://blockml.org/bml";
export const XSI_NS = "http://www.w3.org/2001/XMLSchema-instance";
export const SCHEMA_LOCATION = "http://blockml.org/bml https://blockml.org/schemas/bml.xsd";
export const DEFAULT_BASE_TYPE = "org.blockml.bml.core.Block";
export const ENGLISH_FQN = "org.blockml.bml.language.English";
/** Conventional prefixes for well-known org.blockml.bml.* packages. */
export const KNOWN_PACKAGE_PREFIXES = {
    "org.blockml.bml": "blockml",
    "org.blockml.bml.core": "core",
    "org.blockml.bml.type": "type",
    "org.blockml.bml.unit": "unit",
    "org.blockml.bml.language": "lang",
    "org.blockml.bml.definition": "def",
    "org.blockml.bml.annotation": "ann",
    "org.blockml.bml.annotation.BmlAnnotation": "bml",
    "org.blockml.bml.bom": "bom",
    "org.blockml.bml.compiler.parser": "parser",
    "org.blockml.bml.compiler.serializer": "serializer",
    "org.blockml.bml.compiler.validator": "validator",
    "org.blockml.bml.compiler.runtime": "runtime",
    "org.blockml.bml.framework": "framework",
    "org.blockml.bml.search": "search",
    "org.blockml.bml.graph": "graph",
    "org.blockml.bml.transformer": "transformer",
    "org.blockml.bml.cli": "cli",
    "org.blockml.bml.builder": "builder",
    "org.blockml.bml.workspace": "workspace",
    "org.blockml.bml.target.blockdoc": "blockdoc",
    "org.blockml.bml.target.xsd": "xsd",
    "org.blockml.bml.target.fatblock": "fatblock",
};
export function packageOfFqn(fqn) {
    const index = fqn.lastIndexOf(".");
    return index === -1 ? fqn : fqn.slice(0, index);
}
export function shortNameOfFqn(fqn) {
    const index = fqn.lastIndexOf(".");
    return index === -1 ? fqn : fqn.slice(index + 1);
}
export function prefixForPackage(pkg, bindings) {
    for (const [prefix, uri] of Object.entries(bindings)) {
        if (uri === pkg && prefix !== "") {
            return prefix;
        }
    }
    const known = KNOWN_PACKAGE_PREFIXES[pkg];
    const last = pkg.split(".").pop()?.toLowerCase() || "ns";
    const preferred = known ?? last;
    if (!bindings[preferred] || bindings[preferred] === pkg) {
        return preferred;
    }
    let n = 2;
    while (bindings[`${preferred}${n}`] && bindings[`${preferred}${n}`] !== pkg) {
        n += 1;
    }
    return `${preferred}${n}`;
}
export function orderedBindings(bindings) {
    const ordered = {};
    if (bindings[""]) {
        ordered[""] = bindings[""];
    }
    if (bindings.xsi) {
        ordered.xsi = bindings.xsi;
    }
    const rest = Object.entries(bindings)
        .filter(([prefix]) => prefix !== "" && prefix !== "xsi")
        .sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]));
    for (const [prefix, uri] of rest) {
        ordered[prefix] = uri;
    }
    return ordered;
}
//# sourceMappingURL=namespaces.js.map