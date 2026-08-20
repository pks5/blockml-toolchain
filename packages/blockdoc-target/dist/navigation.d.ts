import type { TypeRegistry } from "@blockml/framework";
import type { BlockDocOptions } from "./options.js";
export declare function collectRootFqns(registry: TypeRegistry): string[];
export declare function rootFqnForBlock(fqn: string, rootFqns: string[]): string | undefined;
export declare function packageSegmentLabel(packagePrefix: string): string;
export declare function blockPathSegments(fqn: string, rootFqn: string): string[];
export declare function collectPackagePrefixes(rootFqns: string[]): string[];
export declare function renderDottedPackagePath(packageFqn: string, pagePath: string, options: Required<BlockDocOptions>, knownFqns: Set<string>): string;
export declare function renderNavigationBreadcrumb(fqn: string, rootFqn: string, pagePath: string, options: Required<BlockDocOptions>, rootIndexPath: string): string;
//# sourceMappingURL=navigation.d.ts.map