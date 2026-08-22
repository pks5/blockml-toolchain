import { type RenderTarget } from "@blockml/compiler";
import type { BomConfig } from "./load-config.js";
import { type TargetCliHints } from "./load-target-plugin.js";
export type { TargetCliHints } from "./load-target-plugin.js";
export declare function registerTargetFactory(name: string, factory: () => RenderTarget, hints?: TargetCliHints): void;
export declare function getTargetCliHints(name: string): TargetCliHints | undefined;
export declare function getTargetFactory(name: string): (() => RenderTarget) | undefined;
export declare function builtinTargetNames(): string[];
export declare function bootstrapTargets(config: BomConfig, requested?: string[], rootDir?: string): Promise<void>;
export declare function resetBootstrapTargets(): void;
//# sourceMappingURL=bootstrap-targets.d.ts.map