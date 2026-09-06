import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { peekLibraryTypeFqn, resolveLibrarySeeds } from "@blockml/framework";
import { TransformError } from "./errors.js";

export interface TargetLibrary {
  /** Library Block FQN, e.g. org.blockml.bml.workspace.Library */
  libraryFqn: string;
  /** Package FQN, e.g. org.blockml.bml.workspace */
  packageFqn: string;
  /** Absolute path to Library.bml */
  libraryFile: string;
  /** dirname(Library.bml) — physical package root for `_meta` */
  libraryRoot: string;
}

/**
 * Target library for `_meta/transform`. `--library` wins; otherwise
 * cwd `package.json` `blockml.library`. Missing both is a resolve error.
 */
export function resolveTargetLibrary(
  workspaceRoot: string,
  libraryPath?: string,
): TargetLibrary {
  const libraryFile = resolveLibraryFile(workspaceRoot, libraryPath);
  const libraryFqn = peekLibraryTypeFqn(libraryFile);
  if (!libraryFqn) {
    throw new TransformError(
      "resolve",
      `Not a readable Library.bml: ${libraryFile}`,
    );
  }
  const packageFqn = packageFqnFromLibraryType(libraryFqn);
  if (!packageFqn) {
    throw new TransformError(
      "resolve",
      `${libraryFile} type ${libraryFqn} is not a Library (expected {package}.Library)`,
    );
  }
  return {
    libraryFqn,
    packageFqn,
    libraryFile,
    libraryRoot: dirname(libraryFile),
  };
}

export function packageFqnFromLibraryType(libraryTypeFqn: string): string | undefined {
  if (!libraryTypeFqn.endsWith(".Library")) {
    return undefined;
  }
  const packageFqn = libraryTypeFqn.slice(0, -".Library".length);
  return packageFqn.length > 0 ? packageFqn : undefined;
}

function resolveLibraryFile(workspaceRoot: string, libraryPath?: string): string {
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
    throw new TransformError(
      "resolve",
      "Specify --library or declare package.json blockml.library",
    );
  }
  if (!existsSync(identity)) {
    throw new TransformError(
      "resolve",
      `package.json blockml.library not found: ${identity}`,
    );
  }
  return identity;
}
