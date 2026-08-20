import type { RenderTarget } from "./types.js";

const targets = new Map<string, RenderTarget>();

export function registerTarget(target: RenderTarget): void {
  targets.set(target.name, target);
}

export function getTarget(name: string): RenderTarget | undefined {
  return targets.get(name);
}

export function clearTargets(): void {
  targets.clear();
}

export function registeredTargetNames(): string[] {
  return [...targets.keys()];
}
