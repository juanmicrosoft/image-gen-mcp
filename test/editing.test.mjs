import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { sha256 } from "../dist/artifacts.js";

test("real stdio restart preserves A-to-B/A-to-C lineage and rejects missing, changed and ambiguous sources", async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "edit-tools-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  const connect = async () => {
    const client = new Client({ name: "edit-test", version: "1" });
    const transport = new StdioClientTransport({
      command: process.execPath, args: ["test/fixtures/image-server.mjs"], stderr: "pipe",
      env: {
        AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com",
        AZURE_OPENAI_IMAGE_DEPLOYMENT: "alias", IMAGE_GEN_OUTPUT_DIR: root,
        IMAGE_GEN_AUTH: "api-key", AZURE_OPENAI_API_KEY: "fixture-key",
        IMAGE_GEN_PREVIEW: "false", IMAGE_GEN_INPUT_DIRS: JSON.stringify([root]),
      },
    });
    await client.connect(transport);
    return client;
  };
  let client = await connect();
  t.after(() => client.close());
  const call = (name, args) => client.callTool({ name, arguments: { operation_id: randomUUID(), prompt: "An observatory", ...args } });
  const a = (await call("generate_image", {})).structuredContent.artifact;
  const original = await readFile(a.path);
  const b = (await call("edit_image", { source_artifact_id: a.id, prompt: "Change only the sky to coral." })).structuredContent.artifact;
  await client.close();
  client = await connect();
  const c = (await call("edit_image", { source_artifact_id: a.id, prompt: "Keep a blue sky." })).structuredContent.artifact;
  assert.notEqual(b.id, c.id);
  for (const artifact of [b, c]) {
    assert.equal(artifact.metadata.sourceArtifactId, a.id);
    assert.equal(artifact.metadata.sourceHash, a.sha256);
  }
  assert.deepEqual(await readFile(a.path), original);
  assert.equal(sha256(original), a.sha256);
  const pathEdit = await call("edit_image", { source_path: a.path });
  assert.notEqual(pathEdit.isError, true);
  assert.equal(pathEdit.structuredContent.artifact.metadata.sourceHash, a.sha256);
  assert.equal(pathEdit.structuredContent.artifact.metadata.sourceArtifactId, undefined);
  for (const source of [
    {}, { source_artifact_id: a.id, source_path: a.path },
    { source_path: "https://example.com/image.png" }, { source_artifact_id: randomUUID() },
    { source_path: "/outside-approved-roots/image.png" },
    { source_artifact_id: a.id, mask: "mask.png" },
  ]) {
    assert.equal((await call("edit_image", source)).isError, true);
  }
  await writeFile(a.path, await readFile(b.path));
  const changed = await call("edit_image", { source_artifact_id: a.id });
  assert.equal(changed.isError, true);
  assert.equal(changed.structuredContent.error.code, "invalid_input");
  const calls = (await readFile(join(root, "fixture-calls.jsonl"), "utf8")).trim().split("\n").map(JSON.parse);
  assert.equal(calls.length, 4);
  for (const entry of calls.slice(1)) {
    assert.match(entry.url, /\/images\/edits\?/);
    assert.equal(entry.sourceHash, a.sha256);
    assert.deepEqual(entry.fields, ["image", "n", "output_format", "prompt", "quality", "size"]);
    assert.equal(entry.n, "1");
  }
});
