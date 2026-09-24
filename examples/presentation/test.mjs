import assert from "node:assert/strict";
import test from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, open, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { MAX_IMAGE_BYTES } from "../../dist/artifacts.js";

test("example creates a deck, never overwrites it, and rejects invalid or oversized inputs", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "presentation-example-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, "source.png");
  await writeFile(source, await sharp({ create: { width: 1536, height: 864, channels: 3, background: "navy" } }).png().toBuffer());
  const build = (hero, output) => promisify(execFile)(process.execPath, [
    fileURLToPath(new URL("./build.mjs", import.meta.url)), "--hero", hero,
    "--editorial", source, "--continuation", source, "--output", output,
  ]);
  const output = join(root, "example.pptx");
  await build(source, output);
  const original = await readFile(output);
  assert.ok(original.length > 0);
  await assert.rejects(build(source, output), (error) => error.code === 1);
  assert.deepEqual(await readFile(output), original);
  const wrongSize = join(root, "wrong-size.png");
  await writeFile(wrongSize, await sharp({ create: { width: 16, height: 16, channels: 3, background: "navy" } }).png().toBuffer());
  const large = join(root, "large.png");
  const handle = await open(large, "wx");
  try { await handle.truncate(MAX_IMAGE_BYTES + 1); } finally { await handle.close(); }
  for (const invalid of [wrongSize, large, join(root, "missing.png")]) {
    const rejected = join(root, "rejected.pptx");
    await assert.rejects(build(invalid, rejected), (error) => error.code === 1);
    await assert.rejects(stat(rejected), (error) => error.code === "ENOENT");
  }
});
