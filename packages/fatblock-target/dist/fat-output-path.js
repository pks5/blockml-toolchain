import { basename } from "node:path";
export function fatOutputBasename(hostFilePath) {
    const base = basename(hostFilePath);
    if (base.endsWith(".bml")) {
        return `${base.slice(0, -4)}.fat.bml`;
    }
    return `${base}.fat.bml`;
}
//# sourceMappingURL=fat-output-path.js.map