import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { errorResult, normalizeError, parseUsage, providerError } from "../dist/errors.js";

test("provider categories are explicit and never expose raw provider messages", () => {
  for (const [status, provider, expected] of [
    [401, "invalid_key", "authentication"], [401, "PermissionDenied", "permission"],
    [403, "", "permission"], [404, "", "deployment"], [429, "insufficient_quota", "quota"],
    [429, "RateLimitReached", "throttled"], [400, "contentFilter", "policy"],
    [400, "invalid_value", "invalid_input"], [500, "", "service"],
  ]) {
    const result = errorResult(providerError(status, provider));
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent.error.code, expected);
    assert.equal(result.structuredContent.error.automaticRetry, false);
    assert.equal(result.structuredContent.error.billing, "unknown");
  }
  assert.equal(providerError(400, "contentFilter").knownFailure, true);
  assert.equal(providerError(500, "").knownFailure, false);
});

test("untrusted exception content and unsafe request IDs never escape", () => {
  const secret = "prompt-or-key-secret";
  for (const error of [new Error(secret), z.string().parse.bind(null, 1)]) {
    let value = error;
    if (typeof error === "function") { try { error(); } catch (failure) { value = failure; } }
    assert.ok(!JSON.stringify(errorResult(value)).includes(secret));
  }
  assert.equal(providerError(401, "", "key with spaces\nsecret").requestId, null);
  const cancelled = Object.assign(new Error(secret), { name: "AbortError" });
  assert.equal(normalizeError(cancelled).code, "timeout");
  assert.equal(normalizeError(Object.assign(new Error(secret), { code: "ENOSPC" })).code, "persistence");
});

test("usage is unknown when missing, never invented or made into zero", () => {
  assert.equal(parseUsage(undefined), null);
  assert.equal(parseUsage({}), null);
  assert.deepEqual(parseUsage({ output_tokens: 1078, prompt: "not retained" }), { output_tokens: 1078 });
  assert.throws(() => parseUsage({ total_tokens: -1 }), /invalid usage/);
});
