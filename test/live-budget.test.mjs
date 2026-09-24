import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { liveBudget } from "../scripts/lib/live-budget.mjs";

test("live requests require explicit opt-in and bounds", () => {
  assert.throws(() => liveBudget({}, "/tmp/budget.json"), /IMAGE_GEN_LIVE/);
  for (const value of ["", "0", "-1", "1.2", "Infinity", "101"]) {
    assert.throws(() => liveBudget({ IMAGE_GEN_LIVE: "true", IMAGE_GEN_MAX_REQUESTS: value }, "/tmp/budget.json"));
  }
});

test("failures consume budget and a restart does not reset it", async () => {
  const directory = await mkdtemp(join(tmpdir(), "image-budget-"));
  try {
    const path = join(directory, "budget.json");
    const env = { IMAGE_GEN_LIVE: "true", IMAGE_GEN_MAX_REQUESTS: "1" };
    let calls = 0;
    await assert.rejects(liveBudget(env, path).run(async () => {
      calls++;
      throw new Error("unknown provider outcome");
    }), /unknown provider/);
    await assert.rejects(liveBudget(env, path).run(async () => calls++), /exhausted/);
    assert.equal(calls, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("a ledger permits only one concurrent live request", async () => {
  const directory = await mkdtemp(join(tmpdir(), "image-budget-"));
  let release;
  const wait = new Promise((resolve) => { release = resolve; });
  let started;
  const ready = new Promise((resolve) => { started = resolve; });
  try {
    const budget = liveBudget({ IMAGE_GEN_LIVE: "true", IMAGE_GEN_MAX_REQUESTS: "2" }, join(directory, "budget.json"));
    const first = budget.run(async () => { started(); await wait; });
    await ready;
    await assert.rejects(budget.run(async () => {}), /busy or interrupted/);
    release();
    await first;
  } finally {
    release();
    await rm(directory, { recursive: true, force: true });
  }
});
