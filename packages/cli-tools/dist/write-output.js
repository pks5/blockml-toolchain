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
    const rootFiles = options.rootFiles ?? output.rootFiles ?? [];
    const rootFilesWritten = [];
    for (const file of rootFiles) {
        const targetPath = join(resolve(rootDir), file.path);
        mkdirSync(dirname(targetPath), { recursive: true });
        writeFileSync(targetPath, file.content, "utf8");
        rootFilesWritten.push(file.path);
    }
    return {
        filesWritten: output.files.length,
        rootFilesWritten,
    };
}
//# sourceMappingURL=write-output.js.map