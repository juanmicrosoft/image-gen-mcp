import assert from "node:assert/strict";
import test from "node:test";
import { capabilitiesTool } from "../dist/capabilities.js";
import { loadConfiguration } from "../dist/config.js";

const env = {
  AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com",
  AZURE_OPENAI_IMAGE_DEPLOYMENT: "an-arbitrary-alias",
  IMAGE_GEN_OUTPUT_DIR: "/private/tmp/image-gen",
};
const signal = new AbortController().signal;

test("diagnostics distinguish configured profile from unknown deployment/inference without network requests", async () => {
  let credentials = 0;
  const tool = capabilitiesTool(() => loadConfiguration(env, () => ({
    async getToken() { credentials++; return { token: "private-token" }; },
  })));
  const result = await tool.invoke({}, signal);
  assert.equal(credentials, 0);
  assert.equal(result.isError, false);
  assert.equal(result.structuredContent.model.deployed, null);
  assert.equal(result.structuredContent.model.observed, null);
  assert.deepEqual(result.structuredContent.profile.sizes, ["1536x864"]);
  assert.deepEqual(result.structuredContent.profile.qualities, ["high"]);
  assert.equal(result.structuredContent.checks.managementMetadata.status, "unverified");
  assert.equal(result.structuredContent.checks.inference.status, "unverified");
  const checked = await tool.invoke({ check_credentials: true }, signal);
  assert.equal(credentials, 1);
  assert.equal(checked.structuredContent.checks.credentialAcquisition.status, "passed");
  assert.equal(checked.structuredContent.checks.inference.status, "unverified");
  assert.ok(!JSON.stringify(checked).includes("private-token"));
});

test("expired credentials and unavailable management access never masquerade as inference results", async () => {
  const result = await capabilitiesTool(() => loadConfiguration(env, () => ({
    async getToken() { throw new Error("expired private-token"); },
  }))).invoke({ check_credentials: true }, signal);
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.checks.credentialAcquisition.status, "failed");
  assert.equal(result.structuredContent.checks.managementMetadata.status, "unverified");
  assert.equal(result.structuredContent.checks.inference.status, "unverified");
  assert.ok(!JSON.stringify(result).includes("private-token"));
});

test("wrong endpoint and unknown profile produce actionable configuration failures, not startup crashes", async () => {
  for (const patch of [{ AZURE_OPENAI_ENDPOINT: "https://example.com" }, { AZURE_OPENAI_IMAGE_MODEL: "unknown" }]) {
    const result = await capabilitiesTool(() => loadConfiguration({ ...env, ...patch })).invoke({}, signal);
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent.checks.configuration.status, "failed");
    assert.equal(result.structuredContent.model.configured, null);
  }
  assert.equal((await capabilitiesTool().invoke({ generate: true }, signal)).isError, true);
});

test("API key presence is not verified authentication and acquisition is cancellable", async () => {
  const tool = capabilitiesTool(() => loadConfiguration({
    ...env, IMAGE_GEN_AUTH: "api-key", AZURE_OPENAI_API_KEY: "private-key",
  }));
  const result = await tool.invoke({ check_credentials: true }, signal);
  assert.match(result.structuredContent.checks.credentialAcquisition.detail, /validity.*unverified/);
  assert.ok(!JSON.stringify(result).includes("private-key"));
  const cancelled = AbortSignal.abort();
  assert.equal((await tool.invoke({ check_credentials: true }, cancelled)).isError, true);
});
