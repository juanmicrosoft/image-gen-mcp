import assert from "node:assert/strict";
import test from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

test("evaluation rejects invalid cases and source mismatches before any attempt or budget reservation", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "image-evaluation-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const args of [
    ["--case", "unknown"], ["--case", "edit"],
    ["--case", "edit", "--source-artifact", ""],
    ["--case", "generation", "--source-artifact", randomUUID()],
  ]) {
    await assert.rejects(promisify(execFile)(process.execPath, [
      "scripts/evaluate.mjs", "--ledger", join(root, "budget.json"), "--record", join(root, "result.json"), ...args,
    ], { env: { IMAGE_GEN_LIVE: "true", IMAGE_GEN_MAX_REQUESTS: "3" } }), (error) => error.code === 1);
    assert.deepEqual(await readdir(root), []);
  }
});
