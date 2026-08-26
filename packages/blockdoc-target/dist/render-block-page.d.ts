import type { BlockDefinition } from "@blockml/bom";
import { type SiteNav } from "./navigation.js";
import type { BlockDocOptions } from "./options.js";
export declare function renderBlockPage(block: BlockDefinition, options: Required<BlockDocOptions>, nav: SiteNav, knownFqns: Set<string>, _rootFqn: string): string;
export declare function renderIndexPage(title: string, rootFqns: string[], options: Required<BlockDocOptions>, indexPath: string, nav: SiteNav): string;
//# sourceMappingURL=render-block-page.d.ts.map