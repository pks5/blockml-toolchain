import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const INDEX_LOCK_FILE = "index.lock";

const LOCK_WAIT_MS = 120_000;
const LOCK_POLL_MS = 50;
const STALE_LOCK_MS = 120_000;

export function isLadybugLockError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /Could not set lock|Resource temporarily unavailable/i.test(message);
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const LADYBUG_RETRY_DELAYS_MS = [50, 100, 200, 400, 800, 1600, 3200, 5000, 5000, 5000];

export async function withLadybugLockRetry<T>(run: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= LADYBUG_RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (!isLadybugLockError(error) || attempt === LADYBUG_RETRY_DELAYS_MS.length) {
        throw error;
      }
      await delay(LADYBUG_RETRY_DELAYS_MS[attempt]!);
    }
  }
  throw lastError;
}

function lockPath(indexDir: string): string {
  return join(indexDir, INDEX_LOCK_FILE);
}

function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function lockIsStale(path: string): boolean {
  try {
    const text = readFileSync(path, "utf8");
    const pid = Number(text.split("\n")[0]);
    if (Number.isInteger(pid) && pid > 0) {
      return !processAlive(pid);
    }
    return Date.now() - statSync(path).mtimeMs > STALE_LOCK_MS;
  } catch {
    return true;
  }
}

function tryAcquireFileLock(indexDir: string): (() => void) | undefined {
  mkdirSync(indexDir, { recursive: true });
  const path = lockPath(indexDir);
  try {
    writeFileSync(path, `${process.pid}\n${Date.now()}\n`, { flag: "wx" });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "EEXIST") {
      throw error;
    }
    if (lockIsStale(path)) {
      rmSync(path, { force: true });
      try {
        writeFileSync(path, `${process.pid}\n${Date.now()}\n`, { flag: "wx" });
      } catch {
        return undefined;
      }
    } else {
      return undefined;
    }
  }
  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    rmSync(path, { force: true });
  };
}

export async function acquireGraphLock(indexDir: string): Promise<() => Promise<void>> {
  const started = Date.now();
  let releaseFile = tryAcquireFileLock(indexDir);
  while (!releaseFile) {
    if (Date.now() - started > LOCK_WAIT_MS) {
      throw new Error("Timed out waiting for the graph index lock.");
    }
    await delay(LOCK_POLL_MS + Math.floor(Math.random() * LOCK_POLL_MS));
    releaseFile = tryAcquireFileLock(indexDir);
  }
  const release = releaseFile;
  return async () => {
    release();
  };
}
