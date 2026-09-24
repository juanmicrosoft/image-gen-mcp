import assert from "node:assert/strict";
import test from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("client configuration requires key-storage consent, writes private selected settings and never overwrites", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "client-config-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const output = join(root, "mcp.json");
  const env = {
    AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com", AZURE_OPENAI_IMAGE_DEPLOYMENT: "alias",
    IMAGE_GEN_OUTPUT_DIR: root, IMAGE_GEN_AUTH: "api-key", AZURE_OPENAI_API_KEY: "fixture-private-key",
    GITHUB_TOKEN: "unrelated-secret",
  };
  const run = (...args) => promisify(execFile)(process.execPath, ["scripts/configure-client.mjs", "--output", output, ...args], { env });
  await assert.rejects(run(), (error) => error.code === 1 && !error.stderr.includes(env.AZURE_OPENAI_API_KEY));
  await assert.rejects(stat(output), (error) => error.code === "ENOENT");
  const result = await run("--allow-plaintext-key");
  assert.ok(!result.stdout.includes(env.AZURE_OPENAI_API_KEY));
  const original = await readFile(output, "utf8");
  const config = JSON.parse(original).mcpServers["image-gen"];
  assert.equal(config.env.AZURE_OPENAI_API_KEY, env.AZURE_OPENAI_API_KEY);
  assert.equal(config.env.GITHUB_TOKEN, undefined);
  assert.equal(config.timeout, 240_000);
  assert.equal((await stat(output)).mode & 0o777, 0o600);
  await assert.rejects(run("--allow-plaintext-key"), (error) => error.code === 1);
  assert.equal(await readFile(output, "utf8"), original);
});
