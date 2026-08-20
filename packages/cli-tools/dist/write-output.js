import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
export function writeOutputFiles(output, outDir, rootDir = process.cwd()) {
    const base = resolve(rootDir, outDir);
    for (const file of output.files) {
        const targetPath = join(base, file.path);
        mkdirSync(dirname(targetPath), { recursive: true });
        writeFileSync(targetPath, file.content, "utf8");
    }
}
//# sourceMappingURL=write-output.js.map