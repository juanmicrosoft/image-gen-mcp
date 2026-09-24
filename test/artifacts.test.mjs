import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { crc32 } from "node:zlib";
import { ArtifactStore, readLocalImage, validatePng } from "../dist/artifacts.js";

const metadata = { deployment: "images", model: "gpt-image-2.5-sunburst", modelEvidence: "configured", size: "16x16", quality: "low" };
const png = () => sharp({ create: { width: 16, height: 16, channels: 4, background: "#205050" } }).png().toBuffer();
const temporaryRoot = async () => realpath(await mkdtemp(join(tmpdir(), "artifact-")));
test("artifact/manifest survives restart, never overwrites and detects mutation", async () => {
  const root = await temporaryRoot();
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
  const root = await temporaryRoot();
  try {
    const store = await ArtifactStore.create(root);
    const bytes = await png();
    await assert.rejects(validatePng(Buffer.from("not an image")), /PNG/);
    await assert.rejects(validatePng(bytes.subarray(0, 40)));
    await assert.rejects(store.save(bytes, { ...metadata, size: "32x32" }), /dimensions/);
    await assert.rejects(store.get("../escape"));
    await writeFile(join(root, "source.png"), bytes);
    assert.deepEqual(await readLocalImage(join(root, "source.png"), [root]), bytes);
    await writeFile(join(root, "wrong.jpg"), bytes);
    await assert.rejects(readLocalImage(join(root, "wrong.jpg"), [root]), /filename/);
    await writeFile(join(root, "not-png.png"), Buffer.from("not a PNG"));
    await assert.rejects(readLocalImage(join(root, "not-png.png"), [root]), /PNG/);
    await assert.rejects(readLocalImage(join(root, "source.png"), [join(root, "missing")]));
    await symlink(join(root, "source.png"), join(root, "link.png"));
    await assert.rejects(readLocalImage(join(root, "link.png"), [root]), /Symlink/);
    await assert.rejects(readLocalImage("source.png", [root]), /absolute/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("FIFO image and manifest paths are rejected without opening a blocking read", { skip: process.platform === "win32", timeout: 2000 }, async () => {
  const root = await temporaryRoot();
  try {
    execFileSync("mkfifo", [join(root, "pipe.png")]);
    await assert.rejects(readLocalImage(join(root, "pipe.png"), [root]), /regular file/);
    const store = await ArtifactStore.create(root);
    const artifact = await store.save(await png(), metadata);
    const manifest = join(root, artifact.id, "manifest.json");
    await rm(manifest);
    execFileSync("mkfifo", [manifest]);
    await assert.rejects(store.get(artifact.id), /regular file/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("a valid two-frame APNG is rejected explicitly", async () => {
  const bytes = await png();
  const chunks = [];
  for (let p = 8; p < bytes.length;) {
    const length = bytes.readUInt32BE(p);
    chunks.push({ type: bytes.toString("ascii", p + 4, p + 8), data: bytes.subarray(p + 8, p + 8 + length) });
    p += length + 12;
  }
  const chunk = (type, data) => {
    const result = Buffer.alloc(data.length + 12);
    result.writeUInt32BE(data.length);
    result.write(type, 4);
    data.copy(result, 8);
    result.writeUInt32BE(crc32(result.subarray(4, -4)), result.length - 4);
    return result;
  };
  const animation = Buffer.alloc(8);
  animation.writeUInt32BE(2);
  const control = (sequence) => {
    const data = Buffer.alloc(26);
    data.writeUInt32BE(sequence);
    data.writeUInt32BE(16, 4); data.writeUInt32BE(16, 8);
    data.writeUInt16BE(1, 20); data.writeUInt16BE(10, 22);
    return chunk("fcTL", data);
  };
  const imageData = Buffer.concat(chunks.filter((c) => c.type === "IDAT").map((c) => c.data));
  const second = Buffer.alloc(imageData.length + 4);
  second.writeUInt32BE(2); imageData.copy(second, 4);
  const animated = Buffer.concat([
    bytes.subarray(0, 8), chunk("IHDR", chunks.find((c) => c.type === "IHDR").data),
    chunk("acTL", animation), control(0), chunk("IDAT", imageData),
    control(1), chunk("fdAT", second), chunk("IEND", Buffer.alloc(0)),
  ]);
  await sharp(animated).raw().toBuffer();
  await assert.rejects(validatePng(animated), /Animated PNG/);
});

test("disk-full failure never commits an artifact and concurrent IDs never overwrite", async () => {
  const root = await temporaryRoot();
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
