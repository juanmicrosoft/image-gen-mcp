import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { generate } from "../dist/provider.js";
const input = { prompt: "A fixture", size: "1536x864", quality: "high" };
const config = { endpoint: "https://example.openai.azure.com/", deployment: "alias", headers: async () => ({ "api-key": "fixture-key" }) };
const signal = new AbortController().signal;
const png = await sharp({ create: { width: 1536, height: 864, channels: 3, background: "navy" } }).png().toBuffer();
const valid = { data: [{ b64_json: png.toString("base64") }], size: "1536x864", output_format: "png", quality: "high" };

test("observed response shape preserves unknown usage and rejects malformed formats, URLs and counters", async () => {
  const fixtures = [
    {}, { data: [{ url: "https://example.com/private.png" }] },
    { ...valid, output_format: "jpeg" }, { ...valid, size: "864x1536" },
    { ...valid, usage: { total_tokens: -1 } }, { ...valid, usage: { input_tokens: 1.5 } },
    { data: [{ b64_json: "not-base64" }] },
  ];
  for (const fixture of fixtures) {
    let calls = 0;
    await assert.rejects(generate(config, input, signal, async () => {
      calls++; return Response.json(fixture);
    }), (error) => error.code === "provider_output" && !error.message.includes("private.png"));
    assert.equal(calls, 1);
  }
  const result = await generate(config, input, signal, async () => Response.json(valid, {
    headers: { "x-ms-request-id": "unsafe request id" },
  }));
  assert.equal(result.usage, null);
  assert.equal(result.requestId, null);
  assert.deepEqual(result.bytes, png);
});

test("HTTP error bodies never leak private provider text and failures have no retry", async () => {
  for (const [status, code] of [[401, "authentication"], [403, "permission"], [404, "deployment"], [429, "throttled"], [500, "service"]]) {
    let calls = 0;
    await assert.rejects(generate(config, input, signal, async () => {
      calls++; return Response.json({ error: { message: "private-provider-content" } }, { status });
    }), (error) => error.code === code && !error.message.includes("private-provider-content"));
    assert.equal(calls, 1);
  }
});
