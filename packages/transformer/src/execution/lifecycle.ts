import { join } from "node:path";
import type { LifecycleStage } from "./constants.js";
import {
  LIFECYCLE_STAGES,
  META_SEGMENT,
  TRANSFORM_PACKAGE,
  TRANSFORM_PACKAGE_SEGMENT,
} from "./constants.js";

export interface ParsedExecutionFqn {
  libraryFqn: string;
  stage: LifecycleStage;
  name: string;
  fqn: string;
}

const EXECUTION_FQN = new RegExp(
  `^(.+)\\.${TRANSFORM_PACKAGE.replaceAll(".", "\\.")}\\.(${LIFECYCLE_STAGES.join("|")})\\.([^.]+)$`,
);

export function isLifecycleStage(value: string): value is LifecycleStage {
  return (LIFECYCLE_STAGES as readonly string[]).includes(value);
}

export function parseExecutionFqn(fqn: string): ParsedExecutionFqn | undefined {
  const match = EXECUTION_FQN.exec(fqn);
  if (!match) {
    return undefined;
  }
  return {
    libraryFqn: match[1]!,
    stage: match[2] as LifecycleStage,
    name: match[3]!,
    fqn,
  };
}

export interface ParsedTransformLocation {
  libraryFqn: string;
  segment: string;
  name: string;
  fqn: string;
}

const TRANSFORM_LOCATION = new RegExp(
  `^(.+)\\.${TRANSFORM_PACKAGE.replaceAll(".", "\\.")}\\.([^.]+)\\.([^.]+)$`,
);

/** Any `{library}._meta.transform.{segment}.{name}` FQN, including `available`. */
export function parseTransformLocation(
  fqn: string,
): ParsedTransformLocation | undefined {
  const match = TRANSFORM_LOCATION.exec(fqn);
  if (!match) {
    return undefined;
  }
  return {
    libraryFqn: match[1]!,
    segment: match[2]!,
    name: match[3]!,
    fqn,
  };
}

export function executionFqn(
  libraryFqn: string,
  stage: LifecycleStage,
  name: string,
): string {
  return `${libraryFqn}.${TRANSFORM_PACKAGE}.${stage}.${name}`;
}

export function transformPackageFqn(
  libraryFqn: string,
  segment: string,
): string {
  return `${libraryFqn}.${TRANSFORM_PACKAGE}.${segment}`;
}

export function lifecyclePackageFqn(
  libraryFqn: string,
  stage: LifecycleStage,
): string {
  return transformPackageFqn(libraryFqn, stage);
}

export function padSequence(sequence: number): string {
  return String(sequence).padStart(5, "0");
}

export function formatNameTimestamp(date: Date): string {
  return compactTimestamp(date);
}

/** ISO 8601 local date-time without timezone marker, e.g. 2026-08-30T01:17:02 */
export function formatDateTimeProperty(date: Date): string {
  const y = String(date.getFullYear()).padStart(4, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}:${s}`;
}

export function sanitizeBlockName(name: string): string {
  return name.replace(/[^A-Za-z0-9_]/g, "");
}

export function generateExecutionName(
  sequence: number,
  originalName: string,
  startedAt: Date,
): string {
  const safe = sanitizeBlockName(originalName) || "Execution";
  return `T${padSequence(sequence)}_${safe}_${formatNameTimestamp(startedAt)}`;
}

export function executionFilePath(
  libraryRoot: string,
  stage: LifecycleStage,
  name: string,
): string {
  return join(
    libraryRoot,
    META_SEGMENT,
    TRANSFORM_PACKAGE_SEGMENT,
    stage,
    `${name}.bml`,
  );
}

function compactTimestamp(date: Date): string {
  const y = String(date.getFullYear()).padStart(4, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${y}${m}${d}T${h}${min}${s}`;
}
