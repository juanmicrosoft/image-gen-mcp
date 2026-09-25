import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { loadConfiguration } from "../dist/config.js";
import { createServer } from "../dist/server.js";
import { imageTools } from "../dist/image-tools.js";

const png = await sharp({ create: { width: 1536, height: 864, channels: 3, background: "#123456" } }).png().toBuffer();
const signal = new AbortController().signal;
async function setup(t, fetcher, preview = false) {
  const root = await realpath(await mkdtemp(join(tmpdir(), "image-tools-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  const load = () => loadConfiguration({
    AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com",
    AZURE_OPENAI_IMAGE_DEPLOYMENT: "alias",
    IMAGE_GEN_OUTPUT_DIR: root, IMAGE_GEN_AUTH: "api-key",
    AZURE_OPENAI_API_KEY: "private-key", IMAGE_GEN_PREVIEW: String(preview),
  });
  return { tools: imageTools(load, fetcher), load };
}
const response = () => Response.json({
  data: [{ b64_json: png.toString("base64") }], size: "1536x864", output_format: "png",
  usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
}, { headers: { "x-ms-request-id": "safe-request-id" } });

test("MCP validates options before submission, preserves exact request and replays a durable artifact", async (t) => {
  let calls = 0;
  const { tools, load } = await setup(t, async (url, options) => {
    calls++;
    assert.match(url, /\/images\/generations\?api-version=2025-04-01-preview$/);
    assert.equal(options.redirect, "error");
    assert.equal(options.headers["api-key"], "private-key");
    assert.deepEqual(JSON.parse(options.body), {
      prompt: "  Keep this prompt unchanged.  ", size: "1536x864", quality: "high", n: 1, output_format: "png",
    });
    return response();
  }, true);
  const client = new Client({ name: "generation-test", version: "1" });
  const server = createServer(tools);
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(b);
  await client.connect(a);
  t.after(async () => { await client.close(); await server.close(); });
  const args = { operation_id: randomUUID(), prompt: "  Keep this prompt unchanged.  " };
  for (const invalid of [
    { ...args, size: "1024x1024" }, { ...args, quality: "low" },
    { ...args, n: 2 }, { ...args, prompt: "   " }, { ...args, operation_id: "not-a-uuid" },
  ]) {
    const result = await client.callTool({ name: "generate_image", arguments: invalid });
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent.error.code, "invalid_input");
  }
  assert.equal(calls, 0);
  const result = await client.callTool({ name: "generate_image", arguments: args });
  assert.notEqual(result.isError, true);
  assert.equal(result.structuredContent.artifact.width, 1536);
  assert.equal(result.structuredContent.artifact.height, 864);
  const image = result.content.find((block) => block.type === "image");
  assert.equal(image.mimeType, "image/jpeg");
  assert.ok(Buffer.from(image.data, "base64").length <= 256 * 1024);
  assert.deepEqual((await client.callTool({ name: "generate_image", arguments: args })).structuredContent, result.structuredContent);
  assert.equal(calls, 1);
  const restarted = imageTools(load, async () => { throw new Error("Must not submit again"); });
  const recovered = await restarted.find((tool) => tool.definition.name === "get_operation").invoke({ operation_id: args.operation_id }, signal);
  assert.equal(recovered.structuredContent.state, "succeeded");
  assert.deepEqual(recovered.structuredContent.usage, { input_tokens: 10, output_tokens: 20, total_tokens: 30 });
  assert.ok(!JSON.stringify(recovered).includes(args.prompt));
  const conflict = await restarted[0].invoke({ ...args, prompt: "different" }, signal);
  assert.equal(conflict.structuredContent.error.code, "conflict");
});

test("uncertain failures separate cause from outcome, redact details and never resubmit after restart", async (t) => {
  const privateDetail = "private-key-provider-prompt";
  for (const [cause, category] of [
    [new TypeError(privateDetail, { cause: Object.assign(new Error(privateDetail), { code: "ECONNRESET" }) }), "network"],
    [new TypeError(privateDetail, { cause: Object.assign(new Error(privateDetail), { code: "ECONNREFUSED" }) }), "network"],
    [new DOMException(privateDetail, "TimeoutError"), "timeout"],
    [new DOMException(privateDetail, "AbortError"), "timeout"],
    [new TypeError(privateDetail, { cause: Object.assign(new Error(privateDetail), { code: "UND_ERR_ABORTED" }) }), "internal"],
  ]) {
    let calls = 0;
    const fetcher = async () => { calls++; throw cause; };
    const { tools, load } = await setup(t, fetcher);
    const args = { operation_id: randomUUID(), prompt: privateDetail };
    const result = await tools[0].invoke(args, signal);
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent.operationId, args.operation_id);
    assert.equal(result.structuredContent.error.code, "outcome_unknown");
    assert.equal(result.structuredContent.failureCategory, category);
    assert.equal(result.structuredContent.error.outcome, "unknown");
    assert.equal(result.structuredContent.error.billing, "unknown");
    assert.equal(result.structuredContent.error.automaticRetry, false);
    assert.match(result.structuredContent.error.message, /charges/);
    assert.ok(!JSON.stringify(result).includes(privateDetail));
    assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
    const restarted = imageTools(load, fetcher);
    const status = await restarted.find((tool) => tool.definition.name === "get_operation").invoke({ operation_id: args.operation_id }, signal);
    assert.equal(status.structuredContent.state, "outcome_unknown");
    assert.equal(status.structuredContent.automaticResubmission, false);
    assert.equal(status.structuredContent.operation.artifact, undefined);
    const replay = await restarted[0].invoke(args, signal);
    assert.equal(replay.structuredContent.error.code, "outcome_unknown");
    assert.equal(replay.structuredContent.failureCategory, "outcome_unknown");
    assert.equal(calls, 1);
  }
});

test("provider errors, invalid image outputs and preview opt-out stay explicit", async (t) => {
  for (const [provider, category] of [
    [() => Response.json({ error: { code: "content_filter", message: "private" } }, { status: 400 }), "policy"],
    [() => Response.json({ data: [{ b64_json: "invalid" }] }), "provider_output"],
    [() => Response.json({ data: [{ b64_json: png.toString("base64") }, { b64_json: png.toString("base64") }] }), "provider_output"],
  ]) {
    const { tools } = await setup(t, async () => provider());
    const result = await tools[0].invoke({ operation_id: randomUUID(), prompt: "An image" }, signal);
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent.failureCategory, category);
    assert.ok(!JSON.stringify(result).includes("private"));
  }
  const { tools } = await setup(t, async () => response());
  const result = await tools[0].invoke({ operation_id: randomUUID(), prompt: "An image" }, signal);
  assert.equal(result.structuredContent.preview, "disabled");
  assert.ok(result.content.every((block) => block.type !== "image"));
});

test("provider quality must match when present; absent quality retains requested-option provenance", async (t) => {
  for (const quality of ["high", "low", 1, null, undefined]) {
    let calls = 0;
    const { tools } = await setup(t, async () => {
      calls++;
      return Response.json({ data: [{ b64_json: png.toString("base64") }], ...(quality === undefined ? {} : { quality }) });
    });
    const args = { operation_id: randomUUID(), prompt: "An image" };
    const result = await tools[0].invoke(args, signal);
    if (quality === "high" || quality === undefined) {
      assert.notEqual(result.isError, true);
      assert.equal(result.structuredContent.artifact.metadata.quality, "high");
    } else {
      assert.equal(result.isError, true);
      assert.equal(result.structuredContent.failureCategory, "provider_output");
      const status = await tools.find((tool) => tool.definition.name === "get_operation").invoke({ operation_id: args.operation_id }, signal);
      assert.equal(status.structuredContent.operation.artifact, undefined);
    }
    await tools[0].invoke(args, signal);
    assert.equal(calls, 1);
  }
});
