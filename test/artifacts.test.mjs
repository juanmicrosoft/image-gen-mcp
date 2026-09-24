import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { ArtifactStore, readLocalImage, validatePng } from "../dist/artifacts.js";

const metadata = { deployment: "images", model: "gpt-image-2.5-sunburst", modelEvidence: "configured", size: "16x16", quality: "low" };
const png = () => sharp({ create: { width: 16, height: 16, channels: 4, background: "#205050" } }).png().toBuffer();
test("artifact/manifest survives restart, never overwrites and detects mutation", async () => {
  const root = await mkdtemp(join(tmpdir(), "artifact-"));
  try {
    const store = await ArtifactStore.create(root);
    const bytes = await png();
    const first = await store.save(bytes, metadata);
    assert.deepEqual(await (await ArtifactStore.create(root)).get(first.id), first);
    await assert.rejects(store.save(bytes, metadata, first.id), /EEXIST/);
    const child = await store.save(bytes, { ...metadata, sourceArtifactId: first.id, sourceHash: first.sha256 });
    assert.equal(child.metadata.sourceArtifactId, first.id);
    assert.ok(!(await readFile(join(root, first.id, "manifest.json"), "utf8")).includes("prompt"));
    await writeFile(first.path, await sharp(bytes).negate().png().toBuffer());
    await assert.rejects(store.get(first.id), /changed/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("invalid images, dimensions, paths and symlinks fail explicitly", async () => {
  const root = await mkdtemp(join(tmpdir(), "artifact-"));
  try {
    const store = await ArtifactStore.create(root);
    const bytes = await png();
    await assert.rejects(validatePng(Buffer.from("not an image")), /PNG/);
    await assert.rejects(validatePng(bytes.subarray(0, 40)));
    await assert.rejects(store.save(bytes, { ...metadata, size: "32x32" }), /dimensions/);
    await assert.rejects(store.get("../escape"));
    await writeFile(join(root, "source.png"), bytes);
    await assert.rejects(readLocalImage(join(root, "source.png"), [join(root, "missing")]));
    await symlink(join(root, "source.png"), join(root, "link.png"));
    await assert.rejects(readLocalImage(join(root, "link.png"), [root]), /Symlink/);
    await assert.rejects(readLocalImage("source.png", [root]), /absolute/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("disk-full failure never commits an artifact and concurrent IDs never overwrite", async () => {
  const root = await mkdtemp(join(tmpdir(), "artifact-"));
  try {
    const bytes = await png();
    const id = randomUUID();
    const failing = await ArtifactStore.create(root, async () => {
      throw Object.assign(new Error("disk full"), { code: "ENOSPC" });
    });
    await assert.rejects(failing.save(bytes, metadata, id), { code: "ENOSPC" });
    await assert.rejects(failing.get(id), { code: "ENOENT" });
    const store = await ArtifactStore.create(root);
    const sharedId = randomUUID();
    const results = await Promise.allSettled([store.save(bytes, metadata, sharedId), store.save(bytes, metadata, sharedId)]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal((await store.get(sharedId)).id, sharedId);
  } finally { await rm(root, { recursive: true, force: true }); }
});
