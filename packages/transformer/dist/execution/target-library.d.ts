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
export declare function resolveTargetLibrary(workspaceRoot: string, libraryPath?: string): TargetLibrary;
export declare function packageFqnFromLibraryType(libraryTypeFqn: string): string | undefined;
//# sourceMappingURL=target-library.d.ts.map