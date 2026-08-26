import type { TypeRegistry } from "@blockml/framework";
import type { BlockDocOptions } from "./options.js";
export declare function collectRootFqns(registry: TypeRegistry): string[];
export declare function rootFqnForBlock(fqn: string, rootFqns: string[]): string | undefined;
export declare function packageSegmentLabel(packagePrefix: string): string;
/** Library prefixes from root FQNs named *.Library (strip the trailing .Library). */
export declare function collectLibraryPrefixes(rootFqns: string[]): string[];
/** Longest library prefix that owns this FQN, or undefined. */
export declare function owningLibraryPrefix(fqn: string, libraryPrefixes: string[]): string | undefined;
/** Short unique heading for a library prefix among a set of prefixes. */
export declare function libraryGroupLabel(prefix: string, allPrefixes: string[]): string;
export declare function blockPathSegments(fqn: string, rootFqn: string): string[];
export declare function collectPackagePrefixes(rootFqns: string[]): string[];
export declare function directBlocks(packagePrefix: string, rootFqns: string[]): string[];
export declare function directSubPackages(packagePrefix: string, rootFqns: string[]): string[];
/**
 * Deepest package prefix reached by skipping levels that have exactly one
 * sub-package and no direct blocks. Empty string = site root is interesting.
 */
export declare function firstInterestingPackagePrefix(rootFqns: string[]): string;
export declare const ALL_BLOCKS_FILE = "all-blocks.html";
export interface SiteNav {
    rootIndexPath: string;
    allBlocksPath: string;
}
export declare function resolveSiteNav(rootFqns: string[], options: Required<BlockDocOptions>, libraryPrefix?: string): SiteNav;
export declare function renderDottedPackagePath(packageFqn: string, pagePath: string, options: Required<BlockDocOptions>, knownFqns: Set<string>): string;
export declare function renderNavigationBreadcrumb(fqn: string, rootFqn: string, pagePath: string, options: Required<BlockDocOptions>, rootIndexPath: string): string;
//# sourceMappingURL=navigation.d.ts.map