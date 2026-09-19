import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BomBuilder } from "@blockml/builder";
import { serialize } from "@blockml/serializer";
import { pushLines } from "./cli-style.js";
const FQN_SEGMENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const CLI_PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const AGENTS_TEMPLATE = join(CLI_PACKAGE_ROOT, "templates", "AGENTS.md");
const CORE_LIBRARY_FQN = "org.blockml.bml.Library";
const BLOCK_LIBRARY_BASE = "org.blockml.bml.core.BlockLibrary";
const README_BASE = "org.blockml.bml.core.ReadMe";
const DEFAULT_LIBRARY_VERSION = "0.1.0";
export function isValidPackageFqn(fqn) {
    const parts = fqn.split(".");
    if (parts.length < 2 || !parts.every((part) => FQN_SEGMENT.test(part))) {
        return false;
    }
    if (parts[parts.length - 1] === "Library") {
        return false;
    }
    return parts.includes("bml");
}
function displayPath(file, rootDir) {
    const rel = relative(rootDir, file);
    return rel && !rel.startsWith("..") ? rel : file;
}
function posixJoin(...parts) {
    return parts.join("/");
}
function libraryPointer(srcDir, packageFqn) {
    return `./${posixJoin(srcDir, ...packageFqn.split("."), "Library.bml")}`;
}
function readCliPackageJson() {
    const pkg = JSON.parse(readFileSync(join(CLI_PACKAGE_ROOT, "package.json"), "utf8"));
    return {
        version: pkg.version ?? "0.0.0",
        coreRange: pkg.dependencies?.["@blockml/core"] ?? "^1.4.1",
    };
}
function writeSerialized(builder, destPath, lines, rootDir) {
    const emitted = serialize(builder.seal());
    if (!emitted.success || emitted.text === null) {
        pushLines(lines, `Failed to serialize ${displayPath(destPath, rootDir)}`, "error");
        return false;
    }
    mkdirSync(dirname(destPath), { recursive: true });
    writeFileSync(destPath, emitted.text, "utf8");
    pushLines(lines, `Created ${displayPath(destPath, rootDir)}`, "info");
    return true;
}
function mergePackageJson(rootDir, libraryRel, lines) {
    const pkgPath = join(rootDir, "package.json");
    const { version: cliVersion, coreRange } = readCliPackageJson();
    let pkg;
    let created = false;
    if (existsSync(pkgPath)) {
        try {
            pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
        }
        catch {
            pushLines(lines, "Could not parse package.json.", "error");
            return 2;
        }
    }
    else {
        created = true;
        pkg = {
            name: basename(rootDir) || "blockml-project",
            private: true,
            engines: { node: ">=20" },
        };
    }
    const blockml = pkg.blockml && typeof pkg.blockml === "object"
        ? { ...pkg.blockml }
        : {};
    const existingLibrary = typeof blockml.library === "string" ? blockml.library : undefined;
    if (existingLibrary) {
        const existingAbs = resolve(rootDir, existingLibrary);
        const intendedAbs = resolve(rootDir, libraryRel);
        if (existingAbs !== intendedAbs) {
            pushLines(lines, `package.json blockml.library already points to ${existingLibrary}`, "error");
            return 2;
        }
    }
    else {
        blockml.library = libraryRel;
        pkg.blockml = blockml;
    }
    const dependencies = pkg.dependencies && typeof pkg.dependencies === "object"
        ? { ...pkg.dependencies }
        : {};
    if (dependencies["@blockml/core"] === undefined) {
        dependencies["@blockml/core"] = coreRange;
    }
    pkg.dependencies = dependencies;
    const devDependencies = pkg.devDependencies && typeof pkg.devDependencies === "object"
        ? { ...pkg.devDependencies }
        : {};
    if (devDependencies["@blockml/cli"] === undefined) {
        devDependencies["@blockml/cli"] = `^${cliVersion}`;
    }
    pkg.devDependencies = devDependencies;
    writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
    pushLines(lines, created ? `Created ${displayPath(pkgPath, rootDir)}` : `Updated ${displayPath(pkgPath, rootDir)}`, "info");
    return 0;
}
function createLibrary(packageFqn, destPath) {
    const readmeFqn = `${packageFqn}.README`;
    return BomBuilder.create({
        type: `${packageFqn}.Library`,
        baseType: BLOCK_LIBRARY_BASE,
        is: `The ${packageFqn} project library catalog`,
        documentation: `Project library for ${packageFqn}. Membership is the nearest Library.bml at the same package level or above; search stops one level below the source folder.`,
        version: DEFAULT_LIBRARY_VERSION,
        filePath: destPath,
    })
        .addAggregation({
        name: "readMe",
        typeFqn: README_BASE,
        override: true,
    })
        .addCompositionChild("readMe", readmeFqn)
        .addAggregation({
        name: "dependencies",
        typeFqn: BLOCK_LIBRARY_BASE,
        override: true,
    })
        .addCompositionChild("dependencies", CORE_LIBRARY_FQN);
}
function createReadme(packageFqn, destPath) {
    return BomBuilder.create({
        type: `${packageFqn}.README`,
        baseType: README_BASE,
        is: `Reading entry for the ${packageFqn} project library`,
        documentation: `This is the project library for ${packageFqn}. Start here, then add types with ` +
            "`blockml new`. Domain vocabulary and project-specific rules live in this library.",
        filePath: destPath,
    });
}
function copyIfMissing(destPath, sourcePath, contents, rootDir, lines) {
    if (existsSync(destPath)) {
        pushLines(lines, `Skipped existing ${displayPath(destPath, rootDir)}`, "info");
        return 0;
    }
    if (sourcePath) {
        if (!existsSync(sourcePath)) {
            pushLines(lines, `AGENTS.md template missing: ${sourcePath}`, "error");
            return 1;
        }
        copyFileSync(sourcePath, destPath);
    }
    else if (contents !== undefined) {
        writeFileSync(destPath, contents, "utf8");
    }
    else {
        pushLines(lines, `Nothing to write for ${displayPath(destPath, rootDir)}`, "error");
        return 1;
    }
    pushLines(lines, `Created ${displayPath(destPath, rootDir)}`, "info");
    return 0;
}
export function runInit(parsed, rootDir, lines, usage) {
    const packageFqn = parsed.initFqn?.trim();
    if (!packageFqn) {
        pushLines(lines, "Specify a package FQN.", "error");
        pushLines(lines, usage, "info");
        return 2;
    }
    if (!isValidPackageFqn(packageFqn)) {
        pushLines(lines, `Invalid package FQN: ${packageFqn}`, "error");
        return 2;
    }
    const srcDir = parsed.srcDir?.trim() || "blocks";
    const libraryRel = libraryPointer(srcDir, packageFqn);
    const libraryPath = join(rootDir, srcDir, ...packageFqn.split("."), "Library.bml");
    const readmePath = join(rootDir, srcDir, ...packageFqn.split("."), "README.bml");
    const pkgCode = mergePackageJson(rootDir, libraryRel, lines);
    if (pkgCode !== 0) {
        return pkgCode;
    }
    if (existsSync(libraryPath)) {
        pushLines(lines, `Skipped existing ${displayPath(libraryPath, rootDir)}`, "info");
    }
    else if (!writeSerialized(createLibrary(packageFqn, libraryPath), libraryPath, lines, rootDir)) {
        return 1;
    }
    if (existsSync(readmePath)) {
        pushLines(lines, `Skipped existing ${displayPath(readmePath, rootDir)}`, "info");
    }
    else if (!writeSerialized(createReadme(packageFqn, readmePath), readmePath, lines, rootDir)) {
        return 1;
    }
    const agentsCode = copyIfMissing(join(rootDir, "AGENTS.md"), AGENTS_TEMPLATE, undefined, rootDir, lines);
    if (agentsCode !== 0) {
        return agentsCode;
    }
    const claudeCode = copyIfMissing(join(rootDir, "CLAUDE.md"), undefined, "@AGENTS.md\n", rootDir, lines);
    if (claudeCode !== 0) {
        return claudeCode;
    }
    if (parsed.install === true) {
        const result = spawnSync("npm", ["install"], {
            cwd: rootDir,
            stdio: "inherit",
        });
        if (result.status !== 0) {
            pushLines(lines, "npm install failed.", "error");
            return 1;
        }
    }
    else {
        pushLines(lines, "Next: npm install && npx blockml validate", "info");
    }
    return 0;
}
//# sourceMappingURL=run-init.js.map