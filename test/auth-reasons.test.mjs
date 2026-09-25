import assert from "node:assert/strict";
import test from "node:test";
import { join, resolve } from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { credentialFailure, loadConfiguration } from "../dist/config.js";
import { capabilitiesTool } from "../dist/capabilities.js";
import { generate } from "../dist/provider.js";
import { errorResult } from "../dist/errors.js";

const base = { AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com/",
  AZURE_OPENAI_IMAGE_DEPLOYMENT: "image", IMAGE_GEN_OUTPUT_DIR: resolve(".local/test-output") };
const unavailable = (message) => Object.assign(new Error(message), { name: "CredentialUnavailableError" });
const secret = "PRIVATE-token-tenant-account";

test("credential reasons use narrow signals and never serialize raw errors", async () => {
  const cases = [
    [unavailable(`AADSTS90002 ${secret}`), "tenant_unavailable"],
    [unavailable(`AADSTS50020 ${secret}`), "tenant_unavailable"],
    [unavailable(`AADSTS700082 ${secret}`), "session_expired"],
    [unavailable(`AADSTS700084 ${secret}`), "session_expired"],
    [unavailable(`AADSTS70043 ${secret}`), "session_expired"],
    [unavailable(`Please run 'az login' from a command prompt to authenticate before using this credential. ${secret}`), "login_required"],
    [unavailable(`Azure CLI could not be found. ${secret}`), "cli_unavailable"],
    [Object.assign(new Error(secret), { name: "TimeoutError" }), "credential_timeout"],
    [Object.assign(new Error(secret), { name: "AbortError" }), "cancelled"],
    [new Error(secret, { cause: Object.assign(new Error(secret), { code: "ECONNREFUSED" }) }), "network"],
    [new Error(`AADSTS90002 ${secret}`), "unknown"],
    [unavailable(`AADSTS900020 expired maybe login ${secret}`), "unknown"],
    [unavailable(`Unknown error ${secret}`), "unknown"],
  ];
  for (const [cause, reason] of cases) {
    const config = loadConfiguration(base, () => ({ async getToken() { throw cause; } }));
    const diagnostic = await capabilitiesTool(() => config).invoke({ check_credentials: true }, new AbortController().signal);
    assert.equal(diagnostic.structuredContent.checks.credentialAcquisition.reason, reason);
    assert.equal(diagnostic.isError, true);
    let submitted = false;
    await assert.rejects(generate(config, { prompt: "synthetic", size: "1536x864", quality: "high" },
      new AbortController().signal, async () => { submitted = true; throw new Error("must not submit"); }),
    (error) => {
      const result = errorResult(error);
      assert.equal(result.structuredContent.error.code, "authentication");
      assert.equal(result.structuredContent.error.authReason, reason);
      assert.equal(result.structuredContent.error.outcome, "failed");
      assert.equal(result.structuredContent.error.automaticRetry, false);
      assert.ok(!JSON.stringify(result).includes(secret));
      return true;
    });
    assert.equal(submitted, false);
    assert.ok(!JSON.stringify(diagnostic).includes(secret));
  }
});

test("abort reasons take precedence over ambiguous credential messages", () => {
  const timeout = Object.assign(new Error("private"), { name: "TimeoutError" });
  assert.equal(credentialFailure(new Error("private"), AbortSignal.abort(timeout)).reason, "credential_timeout");
  assert.equal(credentialFailure(new Error("private"), AbortSignal.abort()).reason, "cancelled");
  const failure = credentialFailure(unavailable("AADSTS90002"));
  assert.equal(credentialFailure(failure), failure);
});

test("real SDK collapses synthetic expiry guidance before MCP classification", { skip: process.platform === "win32" }, async (t) => {
  const root = await mkdtemp(join(tmpdir(), "credential-collapse-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [guidance, reason] of [
    ["", "session_expired"],
    [" Please run az login.", "login_required"],
  ]) {
    await writeFile(join(root, "az"),
      `#!/bin/sh\nprintf '%s\\n' 'AADSTS700082 ${secret}${guidance}' >&2\nexit 1\n`,
      { mode: 0o700 });
    const client = new Client({ name: "synthetic-sdk-collapse", version: "1" });
    try {
      await client.connect(new StdioClientTransport({
        command: process.execPath, args: [resolve("dist/cli.js")],
        env: { ...base, PATH: root, HOME: root, AZURE_CONFIG_DIR: root, IMAGE_GEN_AUTH: "azure-cli" },
        stderr: "pipe",
      }));
      const result = await client.callTool({ name: "get_capabilities", arguments: { check_credentials: true } });
      assert.equal(result.isError, true);
      assert.equal(result.structuredContent.checks.credentialAcquisition.reason, reason);
      assert.equal(result.structuredContent.checks.inference.status, "unverified");
      assert.ok(!JSON.stringify(result).includes(secret));
    } finally { await client.close(); }
  }
});
