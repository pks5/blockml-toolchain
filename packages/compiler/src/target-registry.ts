import type { CompileScopeKind, RenderTarget } from "./types.js";

const targets = new Map<string, RenderTarget>();

const VALID_SCOPE_KINDS = new Set<CompileScopeKind>([
  "document",
  "library",
  "corpus",
  "auto",
]);

function assertValidTarget(target: RenderTarget): void {
  if (!target.name || typeof target.name !== "string" || target.name.trim() === "") {
    throw new Error("registerTarget: name must be a non-empty string");
  }
  if (!Array.isArray(target.accepts) || target.accepts.length === 0) {
    throw new Error(`registerTarget: target "${target.name}" accepts must be a non-empty array`);
  }
  for (const kind of target.accepts) {
    if (!VALID_SCOPE_KINDS.has(kind)) {
      throw new Error(
        `registerTarget: target "${target.name}" has invalid accepts value: ${String(kind)}`,
      );
    }
  }
  if (typeof target.render !== "function") {
    throw new Error(`registerTarget: target "${target.name}" render must be a function`);
  }
  if (
    target.validateRequest !== undefined &&
    typeof target.validateRequest !== "function"
  ) {
    throw new Error(
      `registerTarget: target "${target.name}" validateRequest must be a function when set`,
    );
  }
}

export function registerTarget(target: RenderTarget): void {
  assertValidTarget(target);
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
