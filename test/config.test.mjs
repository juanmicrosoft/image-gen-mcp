import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import { loadConfiguration } from "../dist/config.js";
const base = { AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com/",
  AZURE_OPENAI_IMAGE_DEPLOYMENT: "my-image-alias", IMAGE_GEN_OUTPUT_DIR: resolve(".local/test-output") };

test("explicit API key never uses CLI or appears in serialized configuration", async () => {
  const config = loadConfiguration({ ...base, IMAGE_GEN_AUTH: "api-key", AZURE_OPENAI_API_KEY: "secret-key" },
    () => { throw new Error("must not instantiate CLI"); });
  assert.deepEqual(await config.headers(), { "api-key": "secret-key" });
  assert.ok(!JSON.stringify(config).includes("secret-key"));
  assert.equal(config.model, "gpt-image-2.5-sunburst");
});

test("default credential is CLI only with exact audience and optional tenant", async () => {
  let audience;
  let tenant;
  const tenantId = "00000000-0000-4000-8000-000000000001";
  const config = loadConfiguration({ ...base, AZURE_TENANT_ID: tenantId }, (id) => {
    tenant = id;
    return { async getToken(scope) { audience = scope; return { token: "test-token" }; } };
  });
  assert.deepEqual(await config.headers(), { authorization: "Bearer test-token" });
  assert.equal(audience, "https://cognitiveservices.azure.com/.default");
  assert.equal(tenant, tenantId);
  const rejected = loadConfiguration(base, () => ({ async getToken() { throw new Error("private raw error"); } }));
  await assert.rejects(rejected.headers(), (error) => !error.message.includes("private raw error") && /no alternate/.test(error.message));
});

test("unsafe endpoints, ambiguous credentials and missing paths are rejected", () => {
  for (const endpoint of ["http://example.openai.azure.com", "https://evil.example", "https://example.openai.azure.com/openai",
    "https://user:key@example.openai.azure.com/", "https://example.openai.azure.com/?key=x", "https://example.services.ai.azure.com/api/projects/a"]) {
    assert.throws(() => loadConfiguration({ ...base, AZURE_OPENAI_ENDPOINT: endpoint }));
  }
  for (const patch of [{ IMAGE_GEN_OUTPUT_DIR: "relative" }, { AZURE_OPENAI_API_KEY: "secret" },
    { IMAGE_GEN_AUTH: "api-key" }, { IMAGE_GEN_AUTH: "automatic" }, { IMAGE_GEN_INPUT_DIRS: '["relative"]' },
    { IMAGE_GEN_PREVIEW: "yes" }, { AZURE_OPENAI_IMAGE_MODEL: "other" }]) {
    assert.throws(() => loadConfiguration({ ...base, ...patch }));
  }
});
