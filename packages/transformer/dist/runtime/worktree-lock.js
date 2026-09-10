import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { lock } from "proper-lockfile";
import { TransformError } from "../execution/errors.js";
import { resolveGitToplevel, resolveWorkspacePath } from "../pipeline/git.js";
export const TRANSFORM_LOCK_SENTINEL = "transform.lock";
export const TRANSFORM_LOCK_STALE_MS = 30_000;
export const TRANSFORM_LOCK_UPDATE_MS = 10_000;
const BUSY_MESSAGE = [
    "Transformation already running for this worktree.",
    "Only one transformation may run at a time.",
].join("\n");
export function transformLockPath(workspaceRoot) {
    const root = resolveGitToplevel(workspaceRoot) ?? resolveWorkspacePath(workspaceRoot);
    return join(root, ".blockml", TRANSFORM_LOCK_SENTINEL);
}
export async function acquireWorktreeLock(workspaceRoot, executionFqn) {
    const sentinel = transformLockPath(workspaceRoot);
    ensureSentinel(sentinel);
    let release;
    try {
        release = await lock(sentinel, {
            retries: 0,
            stale: TRANSFORM_LOCK_STALE_MS,
            update: TRANSFORM_LOCK_UPDATE_MS,
        });
    }
    catch (error) {
        if (isLockedError(error)) {
            throw new TransformError("busy", formatBusyMessage(sentinel));
        }
        throw error;
    }
    writeLockMetadata(sentinel, {
        pid: process.pid,
        startedAt: new Date().toISOString(),
        executionFqn,
    });
    return {
        async release() {
            try {
                await release();
            }
            catch (error) {
                if (isAlreadyReleasedError(error)) {
                    return;
                }
                throw error;
            }
        },
    };
}
function ensureSentinel(sentinel) {
    mkdirSync(dirname(sentinel), { recursive: true });
    try {
        writeFileSync(sentinel, "", { flag: "wx" });
    }
    catch (error) {
        if (!isNodeError(error) || error.code !== "EEXIST") {
            throw error;
        }
    }
}
function writeLockMetadata(sentinel, metadata) {
    writeFileSync(sentinel, `${JSON.stringify(metadata, null, 2)}\n`);
}
function formatBusyMessage(sentinel) {
    const metadata = readLockMetadata(sentinel);
    if (!metadata) {
        return BUSY_MESSAGE;
    }
    const details = [
        metadata.executionFqn ? `Execution: ${metadata.executionFqn}` : undefined,
        Number.isFinite(metadata.pid) ? `PID: ${metadata.pid}` : undefined,
        metadata.startedAt ? `Started: ${metadata.startedAt}` : undefined,
    ].filter((line) => !!line);
    return details.length > 0 ? `${BUSY_MESSAGE}\n${details.join("\n")}` : BUSY_MESSAGE;
}
function readLockMetadata(sentinel) {
    try {
        const parsed = JSON.parse(readFileSync(sentinel, "utf8"));
        if (!parsed || typeof parsed !== "object") {
            return undefined;
        }
        const record = parsed;
        return {
            pid: typeof record.pid === "number" ? record.pid : Number.NaN,
            startedAt: typeof record.startedAt === "string" ? record.startedAt : "",
            executionFqn: typeof record.executionFqn === "string" ? record.executionFqn : "",
        };
    }
    catch {
        return undefined;
    }
}
function isLockedError(error) {
    return isNodeError(error) && error.code === "ELOCKED";
}
function isAlreadyReleasedError(error) {
    return isNodeError(error) && (error.code === "ERELEASED" || error.code === "ENOTACQUIRED");
}
function isNodeError(error) {
    return !!error && typeof error === "object" && "code" in error;
}
//# sourceMappingURL=worktree-lock.js.map