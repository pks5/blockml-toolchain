import { dirname, join } from "node:path";
import { LIFECYCLE_STAGES, TRANSFORM_PACKAGE, TRANSFORM_PATH, } from "./constants.js";
const EXECUTION_FQN = new RegExp(`^(.+)\\.${TRANSFORM_PACKAGE.replaceAll(".", "\\.")}\\.(${LIFECYCLE_STAGES.join("|")})\\.([^.]+)$`);
export function isLifecycleStage(value) {
    return LIFECYCLE_STAGES.includes(value);
}
export function parseExecutionFqn(fqn) {
    const match = EXECUTION_FQN.exec(fqn);
    if (!match) {
        return undefined;
    }
    return {
        libraryFqn: match[1],
        stage: match[2],
        name: match[3],
        fqn,
    };
}
export function executionFqn(libraryFqn, stage, name) {
    return `${libraryFqn}.${TRANSFORM_PACKAGE}.${stage}.${name}`;
}
export function lifecyclePackageFqn(libraryFqn, stage) {
    return `${libraryFqn}.${TRANSFORM_PACKAGE}.${stage}`;
}
export function padSequence(sequence) {
    return String(sequence).padStart(5, "0");
}
export function formatNameTimestamp(date) {
    return compactTimestamp(date);
}
/** ISO 8601 local date-time without timezone marker, e.g. 2026-08-30T01:17:02 */
export function formatDateTimeProperty(date) {
    const y = String(date.getFullYear()).padStart(4, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const h = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    const s = String(date.getSeconds()).padStart(2, "0");
    return `${y}-${m}-${d}T${h}:${min}:${s}`;
}
export function sanitizeBlockName(name) {
    return name.replace(/[^A-Za-z0-9_]/g, "");
}
export function generateExecutionName(sequence, originalName, startedAt) {
    const safe = sanitizeBlockName(originalName) || "Execution";
    return `T${padSequence(sequence)}_${safe}_${formatNameTimestamp(startedAt)}`;
}
export function executionFilePath(currentPath, stage, name) {
    const replaced = currentPath.replace(new RegExp(`/${TRANSFORM_PATH}/(${LIFECYCLE_STAGES.join("|")})/[^/]+\\.bml$`), `/${TRANSFORM_PATH}/${stage}/${name}.bml`);
    if (replaced !== currentPath) {
        return replaced;
    }
    return join(dirname(currentPath), "..", stage, `${name}.bml`);
}
function compactTimestamp(date) {
    const y = String(date.getFullYear()).padStart(4, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const h = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    const s = String(date.getSeconds()).padStart(2, "0");
    return `${y}${m}${d}T${h}${min}${s}`;
}
//# sourceMappingURL=lifecycle.js.map