import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

test("packed-test proxy forwards exact MCP results, enforces its bound and shuts down its child", { timeout: 15_000 }, async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "packed-proxy-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  const config = join(root, "config.json"), ledger = join(root, "ledger.json");
  await writeFile(config, JSON.stringify({ mcpServers: { "image-gen": {
    command: process.execPath, args: [resolve("test/fixtures/image-server.mjs")],
    env: {
      AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com", AZURE_OPENAI_IMAGE_DEPLOYMENT: "fixture",
      IMAGE_GEN_OUTPUT_DIR: root, IMAGE_GEN_AUTH: "api-key", AZURE_OPENAI_API_KEY: "fixture-key",
      IMAGE_GEN_PREVIEW: "false",
    },
  } } }), { mode: 0o600 });
  const client = new Client({ name: "proxy-test", version: "1" });
  const transport = new StdioClientTransport({
    command: process.execPath, args: ["scripts/packed-smoke-server.mjs"], stderr: "pipe",
    env: { PATH: process.env.PATH, IMAGE_GEN_PACKED_CONFIG: config, IMAGE_GEN_BUDGET_LEDGER: ledger,
      IMAGE_GEN_LIVE: "true", IMAGE_GEN_MAX_REQUESTS: "1", IMAGE_GEN_TEST_HOME: root },
  });
  t.after(() => client.close());
  await client.connect(transport);
  const id = randomUUID();
  const result = await client.callTool({ name: "generate_image", arguments: { operation_id: id, prompt: "fixture" } });
  assert.equal(result.structuredContent.state, "succeeded");
  await assert.rejects(client.callTool({ name: "generate_image", arguments: { operation_id: randomUUID(), prompt: "another" } }), /budget exhausted/);
  const recovered = await client.callTool({ name: "get_operation", arguments: { operation_id: id } });
  assert.equal(recovered.structuredContent.operation.artifact.id, result.structuredContent.artifact.id);
  assert.equal(JSON.parse(await readFile(ledger, "utf8")).used, 1);
  assert.equal((await readFile(join(root, "fixture-calls.jsonl"), "utf8")).trim().split("\n").length, 1);
  assert.ok(!(await readFile(`${ledger}.results.jsonl`, "utf8")).includes("fixture-key"));
  const processRecord = JSON.parse((await readFile(`${ledger}.processes.jsonl`, "utf8")).trim());
  await client.close();
  assert.throws(() => process.kill(processRecord.child, 0), (error) => error.code === "ESRCH");
});
