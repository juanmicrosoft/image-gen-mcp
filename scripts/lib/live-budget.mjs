import { mkdir, open, readFile, rename, rmdir } from "node:fs/promises";
import { dirname, isAbsolute } from "node:path";

async function syncDirectoryTree(directory) {
  for (;;) {
    const handle = await open(directory, "r");
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
}

export function liveBudget(env, ledgerPath, durabilityBarrier = syncDirectoryTree) {
  if (env.IMAGE_GEN_LIVE !== "true") {
    throw new Error("Billable tests require IMAGE_GEN_LIVE=true.");
  }
  if (!/^[1-9]\d*$/.test(env.IMAGE_GEN_MAX_REQUESTS ?? "")) {
    throw new Error("Set IMAGE_GEN_MAX_REQUESTS to an explicit positive integer.");
  }
  const limit = Number(env.IMAGE_GEN_MAX_REQUESTS);
  if (!Number.isSafeInteger(limit) || limit > 100) {
    throw new Error("A live test run is limited to 100 requests.");
  }
  if (!isAbsolute(ledgerPath)) throw new Error("Use an absolute budget ledger path.");

  return {
    async run(submit) {
      await mkdir(dirname(ledgerPath), { recursive: true, mode: 0o700 });
      const lock = `${ledgerPath}.lock`;
      try {
        await mkdir(lock, { mode: 0o700 });
      } catch (error) {
        if (error.code === "EEXIST") {
          throw new Error("Live run busy or interrupted. Inspect the ledger/lock; do not retry blindly.");
        }
        throw error;
      }
      try {
        let used = 0;
        try {
          const previous = JSON.parse(await readFile(ledgerPath, "utf8"));
          if (previous.version !== 1 || previous.limit !== limit ||
              !Number.isSafeInteger(previous.used) || previous.used < 0) {
            throw new Error("Invalid or changed live budget ledger; refusing submission.");
          }
          used = previous.used;
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
        if (used >= limit) throw new Error("Live request budget exhausted.");
        const temporary = `${ledgerPath}.pending`;
        const file = await open(temporary, "wx", 0o600);
        try {
          await file.writeFile(JSON.stringify({ version: 1, limit, used: used + 1 }) + "\n");
          await file.sync();
        } finally {
          await file.close();
        }
        await rename(temporary, ledgerPath);
        await durabilityBarrier(dirname(ledgerPath));
        // Consume the request before submission, including failures and uncertain outcomes.
        return await submit();
      } finally {
        await rmdir(lock);
      }
    },
  };
}
