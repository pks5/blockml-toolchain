import { registerTarget, type RenderTarget } from "@blockml/compiler";
import { BlockDocTarget } from "@blockml/blockdoc-target";
import { XsdTarget } from "@blockml/xsd-target";
import type { BomConfig } from "./load-config.js";

const DEFAULT_TARGETS = ["blockdoc"];

let bootstrapped = false;

const TARGET_FACTORIES: Record<string, () => RenderTarget> = {
  blockdoc: () => new BlockDocTarget(),
  xsd: () => new XsdTarget(),
};

export function bootstrapTargets(config: BomConfig, requested: string[] = []): void {
  if (bootstrapped) {
    return;
  }
  const names = new Set(config.targets?.length ? config.targets : DEFAULT_TARGETS);
  for (const name of requested) {
    names.add(name);
  }
  for (const name of names) {
    const factory = TARGET_FACTORIES[name];
    if (!factory) {
      throw new Error(`Unknown target in targets[]: ${name}`);
    }
    registerTarget(factory());
  }
  bootstrapped = true;
}

export function resetBootstrapTargets(): void {
  bootstrapped = false;
}
