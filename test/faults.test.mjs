import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";
import { ArtifactStore, sha256 } from "../dist/artifacts.js";
import { OperationStore } from "../dist/operations.js";
import { ImageError } from "../dist/errors.js";
import { imageTools } from "../dist/image-tools.js";
import { loadConfiguration } from "../dist/config.js";

const png = await sharp({ create: { width: 1536, height: 864, channels: 3, background: "teal" } }).png().toBuffer();
const metadata = { deployment: "fixture", model: "gpt-image-2.5-sunburst", modelEvidence: "configured", size: "1536x864", quality: "high" };
async function setup(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), "image-fault-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  const artifacts = await ArtifactStore.create(root);
  const original = await artifacts.save(png, metadata);
  const manifest = await readFile(join(root, original.id, "manifest.json"));
  return { root, artifacts, original, manifest, operations: await OperationStore.create(artifacts) };
}
async function unchanged(context) {
  assert.equal(sha256(await readFile(context.original.path)), context.original.sha256);
  assert.deepEqual(await readFile(join(context.root, context.original.id, "manifest.json")), context.manifest);
}

test("pre-submit record failure fails closed with zero submissions and no new artifact", async (t) => {
  const context = await setup(t);
  const id = randomUUID();
  await mkdir(join(context.root, ".operations", `${id}.json`));
  let calls = 0;
  const submit = async () => { calls++; throw new Error("Must not submit"); };
  await assert.rejects(context.operations.run(id, { prompt: "fixture" }, submit));
  await assert.rejects(context.operations.status(id));
  await assert.rejects(context.operations.run(id, { prompt: "fixture" }, submit));
  assert.equal(calls, 0);
  assert.deepEqual((await readdir(context.root)).filter((name) => /^[0-9a-f-]{36}$/.test(name)), [context.original.id]);
  await unchanged(context);
});

test("post-submit timeout, policy, malformed PNG and disk-full retain state without resubmission", async (t) => {
  for (const phase of ["timeout", "policy", "malformed", "disk-full"]) {
    const context = await setup(t);
    const artifacts = phase === "disk-full" ? await ArtifactStore.create(context.root, async (path, bytes) => {
      if (path.endsWith("manifest.json")) throw Object.assign(new Error("Disk full"), { code: "ENOSPC" });
      await writeFile(path, bytes, { flag: "wx" });
    }) : context.artifacts;
    const operations = await OperationStore.create(artifacts);
    const id = randomUUID();
    let calls = 0;
    const submit = async (artifactId) => {
      calls++;
      if (phase === "timeout") throw new DOMException("Private detail", "TimeoutError");
      if (phase === "policy") throw new ImageError("policy", "Rejected fixture", true);
      return artifacts.save(phase === "malformed" ? Buffer.from("invalid") : png, metadata, artifactId);
    };
    await assert.rejects(operations.run(id, { prompt: "fixture" }, submit));
    const status = await operations.status(id);
    assert.equal(status.state, phase === "policy" ? "failed" : "outcome_unknown");
    assert.equal(status.artifact, undefined);
    assert.ok(!(await readdir(context.root)).includes(status.artifactId));
    await assert.rejects(operations.run(id, { prompt: "fixture" }, submit));
    assert.equal(calls, 1);
    await unchanged(context);
  }
});

test("real SIGKILL boundaries preserve request counts and recover only committed artifacts", { timeout: 20_000 }, async (t) => {
  for (const phase of ["post-submit", "post-save", "post-result"]) {
    const context = await setup(t);
    const id = randomUUID();
    const worker = spawn(process.execPath, ["test/fixtures/fault-worker.mjs", context.root, id, phase, context.original.path], {
      stdio: ["ignore", "ignore", "pipe", "ipc"],
    });
    t.after(() => { if (worker.exitCode === null && worker.signalCode === null) worker.kill("SIGKILL"); });
    const [marker] = await once(worker, "message");
    assert.equal(marker.phase, phase);
    const exit = once(worker, "exit");
    worker.kill("SIGKILL");
    await exit;
    const restarted = await OperationStore.create(await ArtifactStore.create(context.root));
    const status = await restarted.status(id);
    assert.equal(status.state, phase === "post-submit" ? "outcome_unknown" : "succeeded");
    if (phase === "post-save") assert.equal(status.recovered, true);
    if (phase === "post-result") assert.equal(status.recovered, false);
    let additional = 0;
    const submit = async () => { additional++; throw new Error("Must not resubmit"); };
    if (phase === "post-submit") await assert.rejects(restarted.run(id, { prompt: "fixture" }, submit));
    else assert.equal((await restarted.run(id, { prompt: "fixture" }, submit)).id, status.artifact.id);
    assert.equal(additional, 0);
    assert.equal((await readFile(join(context.root, "submissions.txt"), "utf8")).trim().split("\n").length, 1);
    if (phase !== "post-result") {
      await assert.rejects(restarted.run(randomUUID(), { prompt: "new" }, submit), (error) => error.code === "busy");
    }
    assert.equal(additional, 0);
    await unchanged(context);
  }
});

test("tool cancellation distinguishes pre-submit from unknown post-submit state without retry", async (t) => {
  for (const before of [true, false]) {
    const context = await setup(t);
    let calls = 0, submitted;
    const started = new Promise((resolve) => { submitted = resolve; });
    const tools = imageTools(() => loadConfiguration({
      AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com", AZURE_OPENAI_IMAGE_DEPLOYMENT: "fixture",
      IMAGE_GEN_OUTPUT_DIR: context.root, IMAGE_GEN_AUTH: "api-key", AZURE_OPENAI_API_KEY: "fixture-key",
    }), async (_url, options) => {
      calls++; submitted();
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => reject(new DOMException("Private detail", "AbortError")), { once: true });
      });
    });
    const controller = new AbortController();
    if (before) controller.abort();
    const id = randomUUID(), args = { operation_id: id, prompt: "fixture" };
    const pending = tools[0].invoke(args, controller.signal);
    if (!before) { await started; controller.abort(); }
    const result = await pending;
    assert.equal(result.isError, true);
    assert.ok(!JSON.stringify(result).includes("Private detail"));
    const status = await context.operations.status(id);
    assert.equal(status?.state ?? null, before ? null : "outcome_unknown");
    assert.equal(calls, before ? 0 : 1);
    if (!before) {
      await tools[0].invoke(args, new AbortController().signal);
      assert.equal(calls, 1);
    }
    await unchanged(context);
  }
});
