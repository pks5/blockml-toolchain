import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { peekLibraryTypeFqn, resolveLibrarySeeds } from "@blockml/framework";
import { TransformError } from "./errors.js";
/**
 * Target library for `_meta/transform`. `--library` wins; otherwise
 * cwd `package.json` `blockml.library`. Missing both is a resolve error.
 */
export function resolveTargetLibrary(workspaceRoot, libraryPath) {
    const libraryFile = resolveLibraryFile(workspaceRoot, libraryPath);
    const libraryFqn = peekLibraryTypeFqn(libraryFile);
    if (!libraryFqn) {
        throw new TransformError("resolve", `Not a readable Library.bml: ${libraryFile}`);
    }
    const packageFqn = packageFqnFromLibraryType(libraryFqn);
    if (!packageFqn) {
        throw new TransformError("resolve", `${libraryFile} type ${libraryFqn} is not a Library (expected {package}.Library)`);
    }
    return {
        libraryFqn,
        packageFqn,
        libraryFile,
        libraryRoot: dirname(libraryFile),
    };
}
export function packageFqnFromLibraryType(libraryTypeFqn) {
    if (!libraryTypeFqn.endsWith(".Library")) {
        return undefined;
    }
    const packageFqn = libraryTypeFqn.slice(0, -".Library".length);
    return packageFqn.length > 0 ? packageFqn : undefined;
}
function resolveLibraryFile(workspaceRoot, libraryPath) {
    const override = libraryPath?.trim();
    if (override) {
        const abs = resolve(workspaceRoot, override);
        if (!existsSync(abs)) {
            throw new TransformError("resolve", `Library not found: ${override}`);
        }
        return abs;
    }
    const identity = resolveLibrarySeeds(workspaceRoot)[0];
    if (!identity) {
        throw new TransformError("resolve", "Specify --library or declare package.json blockml.library");
    }
    if (!existsSync(identity)) {
        throw new TransformError("resolve", `package.json blockml.library not found: ${identity}`);
    }
    return identity;
}
//# sourceMappingURL=target-library.js.map