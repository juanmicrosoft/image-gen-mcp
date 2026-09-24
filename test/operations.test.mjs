import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { ArtifactStore } from "../dist/artifacts.js";
import { OperationStore } from "../dist/operations.js";
const meta = { deployment: "test", model: "gpt-image-2.5-sunburst", modelEvidence: "configured", quality: "high", size: "16x16" };

test("replays are free, changed args conflict, uncertain outcomes never resubmit", async () => {
  const root = await mkdtemp(join(tmpdir(), "operations-"));
  try {
    const artifacts = await ArtifactStore.create(root);
    const store = await OperationStore.create(artifacts);
    const bytes = await sharp({ create: { width: 16, height: 16, channels: 3, background: "#007777" } }).png().toBuffer();
    let calls = 0;
    const submit = async (id) => { calls++; return artifacts.save(bytes, meta, id); };
    const id = randomUUID();
    const first = await store.run(id, { prompt: "test" }, submit);
    const restarted = await OperationStore.create(artifacts);
    assert.equal((await restarted.run(id, { prompt: "test" }, submit)).id, first.id);
    assert.equal(calls, 1);
    await assert.rejects(store.run(id, { prompt: "changed" }, submit), { code: "conflict" });
    const uncertain = randomUUID();
    await assert.rejects(store.run(uncertain, {}, async () => { calls++; throw new Error("timeout"); }), (error) => {
      assert.equal(error.code, "outcome_unknown");
      assert.match(error.message, /processing may continue and charges may apply/);
      assert.match(error.message, /resubmission is unsafe/);
      assert.equal(error.cause.message, "timeout");
      return true;
    });
    await assert.rejects(restarted.run(uncertain, {}, submit), /processing may continue and charges may apply/);
    assert.equal(calls, 2);
    assert.equal((await restarted.status(uncertain)).state, "outcome_unknown");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("post-save interruption recovers the exact committed artifact without another submission", async () => {
  const root = await mkdtemp(join(tmpdir(), "operations-"));
  try {
    const artifacts = await ArtifactStore.create(root);
    const store = await OperationStore.create(artifacts);
    const bytes = await sharp({ create: { width: 16, height: 16, channels: 3, background: "#777700" } }).png().toBuffer();
    const id = randomUUID();
    let saved;
    await assert.rejects(store.run(id, {}, async (artifactId) => {
      saved = await artifacts.save(bytes, meta, artifactId);
      throw new Error("response connection lost");
    }), /charges may apply/);
    const restarted = await OperationStore.create(artifacts);
    assert.equal((await restarted.status(id)).recovered, true);
    assert.equal((await restarted.run(id, {}, async () => { throw new Error("must not submit"); })).id, saved.id);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("concurrent calls are refused while a request is active", async () => {
  const root = await mkdtemp(join(tmpdir(), "operations-"));
  let release;
  const wait = new Promise((resolve) => { release = resolve; });
  let ready;
  const started = new Promise((resolve) => { ready = resolve; });
  try {
    const store = await OperationStore.create(await ArtifactStore.create(root));
    const first = store.run(randomUUID(), {}, async () => { ready(); await wait; throw new Error("cancelled"); });
    const rejected = assert.rejects(first, /processing may continue and charges may apply/);
    await started;
    await assert.rejects(store.run(randomUUID(), {}, async () => {}), { code: "busy" });
    release();
    await rejected;
  } finally { release(); await rm(root, { recursive: true, force: true }); }
});
