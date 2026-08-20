import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
export function writeOutputFiles(output, outDir, rootDir = process.cwd(), options = {}) {
    const base = resolve(rootDir, outDir);
    if (options.cleanOutDir) {
        rmSync(base, { recursive: true, force: true });
    }
    for (const file of output.files) {
        const targetPath = join(base, file.path);
        mkdirSync(dirname(targetPath), { recursive: true });
        writeFileSync(targetPath, file.content, "utf8");
    }
    for (const file of options.rootFiles ?? []) {
        const targetPath = join(resolve(rootDir), file.path);
        mkdirSync(dirname(targetPath), { recursive: true });
        writeFileSync(targetPath, file.content, "utf8");
    }
}
//# sourceMappingURL=write-output.js.map