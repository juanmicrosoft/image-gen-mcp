import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { smokeSource } from "../scripts/lib/smoke-source.mjs";

test("smoke routing distinguishes absence from invalid or explicit editing sources", () => {
  assert.deepEqual(smokeSource(undefined), { tool: "generate_image", args: {} });
  const id = randomUUID();
  assert.deepEqual(smokeSource(id), { tool: "edit_image", args: { source_artifact_id: id } });
  for (const invalid of ["", "not-an-id", " ", null]) assert.throws(() => smokeSource(invalid));
});

test("empty/malformed smoke sources exit before attempts, budget consumption or client calls", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "smoke-source-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const source of ["", "not-an-id"]) {
    await assert.rejects(promisify(execFile)(process.execPath, [
      "scripts/smoke-mcp.mjs", "--ledger", join(root, "ledger.json"),
      "--record", join(root, "record.json"), "--prompt", "An image", "--source-artifact", source,
    ], { env: { IMAGE_GEN_LIVE: "true", IMAGE_GEN_MAX_REQUESTS: "1" } }), (error) => error.code === 1);
    assert.deepEqual(await readdir(root), []);
  }
});
