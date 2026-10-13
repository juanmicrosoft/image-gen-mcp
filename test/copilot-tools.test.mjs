import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { imageTools } from "../dist/image-tools.js";
import { loadConfiguration } from "../dist/config.js";
import { capabilitiesTool } from "../dist/capabilities.js";

const signal = new AbortController().signal;
const png = await sharp({ create: { width: 1312, height: 1199, channels: 3, background: "green" } }).png().toBuffer();
async function setup(t, preview = false) {
  const root = await realpath(await mkdtemp(join(tmpdir(), "copilot-tools-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  const env = { IMAGE_GEN_BACKEND: "copilot", IMAGE_GEN_COPILOT_LOGIN: "fixture-user",
    IMAGE_GEN_OUTPUT_DIR: root, IMAGE_GEN_PREVIEW: String(preview) };
  const state = { requests: 0, pins: 0 };
  const fetcher = async () => {
    state.requests++;
    return Response.json({ data: [{ b64_json: png.toString("base64") }], size: "1312x1199", quality: "low",
      output_format: "png",
      copilot_usage: { total_nano_aiu: 661000000, token_details: [{ model: "gpt-image-2.5-sunburst" }] } });
  };
  const factory = options => ({
    start: async () => {}, stop: async () => [], deleteSession: async () => {},
    getStatus: async () => ({ version: "1.0.96", protocolVersion: 3 }),
    getAuthStatus: async () => ({
      isAuthenticated: true, authType: "user", host: "https://github.com", login: "fixture-user",
    }),
    createSession: async sessionOptions => ({
      sessionId: "fixture", disconnect: async () => {}, abort: async () => {},
      rpc: {
        accounts: { get: async () => ({
          kind: "activeAccount",
          authInfo: {
            type: "user", host: "https://github.com", login: "fixture-user",
            copilotUser: {
              analytics_tracking_id: "fixture", chat_enabled: true, copilot_plan: "enterprise",
              endpoints: { api: "https://api.enterprise.githubcopilot.com" }, login: "fixture-user",
            },
          },
        }) },
        gitHubAuth: {
          setCredentials: async () => { state.pins++; return { success: true, copilotUserResolved: true }; },
          getStatus: async () => ({
            isAuthenticated: true, authType: "user", host: "https://github.com",
            login: "fixture-user", copilotPlan: "enterprise",
          }),
        },
        tools: {
          initializeAndValidate: async () => {},
          getCurrentMetadata: async () => ({ tools: [{ name: "image_generation" }] }),
          execute: async ({ arguments: args }) => {
            state.lastArguments = args;
            const invocation = { sessionId: "fixture", managedSettingsEnabled: false };
            assert.equal((await sessionOptions.onPermissionRequest({
              kind: "custom-tool", toolName: "image_generation", managedApprovalRequired: false,
            }, invocation)).kind, "approve-once");
            if (args.input_images) {
              const path = args.input_images[0].path;
              for (let index = 0; index < 2; index++) {
                assert.equal((await sessionOptions.onPermissionRequest({
                  kind: "read", path, resolvedPath: path, managedApprovalRequired: false,
                  intention: "Read selected image reference",
                }, invocation)).kind, "approve-once");
              }
            }
            const url = `https://api.githubcopilot.com/v1/images/${args.input_images ? "edits" : "generations"}`;
            const response = await options.requestHandler.sendRequest(new Request(url, { method: "POST", body: "{}" }),
              { signal, transport: "http", requestId: "fixture-request", url });
            await response.text();
            return { resultType: "success", textResultForLlm: "Generated" };
          },
        },
      },
    }),
  });
  const load = () => loadConfiguration(env);
  return { root, env, load, factory, fetcher, state, tools: imageTools(load, fetcher, factory, "copilot") };
}

test("Copilot MCP advertises native options, persists actual dimensions and recovers without another request", async t => {
  const { tools, load, factory, fetcher, state } = await setup(t, true);
  assert.deepEqual(tools[0].definition.inputSchema.properties.size.enum, ["auto", "1024x1024", "1536x1024", "1024x1536"]);
  const args = { operation_id: randomUUID(), prompt: "A synthetic robot" };
  assert.equal((await tools[0].invoke({ ...args, size: "1536x864" }, signal)).isError, true);
  assert.equal(state.requests, 0);
  const result = await tools[0].invoke(args, signal);
  assert.notEqual(result.isError, true);
  assert.equal(result.structuredContent.artifact.width, 1312);
  assert.equal(result.structuredContent.artifact.metadata.backend, "copilot");
  assert.equal(result.structuredContent.artifact.metadata.deployment, undefined);
  assert.equal(result.structuredContent.artifact.metadata.authLogin, "fixture-user");
  assert.equal(result.structuredContent.artifact.metadata.authSource, "user");
  assert.equal(result.structuredContent.artifact.metadata.copilotPlan, "enterprise");
  assert.equal(result.structuredContent.artifact.metadata.usage.ai_credits, 0.661);
  assert.ok(result.content.some(content => content.type === "image"));
  const restart = imageTools(load, fetcher, factory, "copilot");
  const recovered = await restart[2].invoke({ operation_id: args.operation_id }, signal);
  assert.equal(recovered.structuredContent.state, "succeeded");
  assert.deepEqual((await restart[0].invoke(args, signal)).structuredContent, result.structuredContent);
  assert.equal(state.requests, 1);
});

test("editing retains immutable source lineage and account/backend changes conflict before submission", async t => {
  const { tools, env, factory, fetcher, state } = await setup(t);
  const args = { operation_id: randomUUID(), prompt: "A synthetic robot" };
  const parent = await tools[0].invoke(args, signal);
  assert.notEqual(parent.isError, true);
  const child = await tools[1].invoke({ operation_id: randomUUID(), prompt: "Make the robot blue",
    source_artifact_id: parent.structuredContent.artifact.id }, signal);
  assert.notEqual(child.isError, true);
  assert.equal(child.structuredContent.artifact.metadata.sourceArtifactId, parent.structuredContent.artifact.id);
  assert.equal(child.structuredContent.artifact.metadata.sourceHash, parent.structuredContent.artifact.sha256);
  assert.equal(state.requests, 2);
  const wrong = imageTools(() => loadConfiguration({ ...env, IMAGE_GEN_COPILOT_LOGIN: "other-user" }), fetcher, factory, "copilot");
  assert.equal((await wrong[0].invoke(args, signal)).structuredContent.error.code, "conflict");
  const azure = imageTools(() => loadConfiguration({
    IMAGE_GEN_OUTPUT_DIR: env.IMAGE_GEN_OUTPUT_DIR, IMAGE_GEN_AUTH: "api-key", AZURE_OPENAI_API_KEY: "fixture",
    AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com/", AZURE_OPENAI_IMAGE_DEPLOYMENT: "fixture",
  }), fetcher);
  assert.equal((await azure[0].invoke(args, signal)).structuredContent.error.code, "conflict");
  assert.equal(state.requests, 2);
});

test("Copilot diagnostics are nonbillable and identity checks never advertise verified inference", async t => {
  const { load, factory, state } = await setup(t);
  const tool = capabilitiesTool(load, factory);
  const configOnly = await tool.invoke({}, signal);
  assert.equal(configOnly.isError, false);
  assert.equal(configOnly.structuredContent.backend, "copilot");
  assert.equal(configOnly.structuredContent.deployment, null);
  assert.equal(configOnly.structuredContent.model.configured, null);
  assert.equal(configOnly.structuredContent.model.observed, null);
  assert.equal(configOnly.structuredContent.model.evidence, "unverified");
  const checked = await tool.invoke({ check_credentials: true }, signal);
  assert.equal(checked.structuredContent.checks.credentialAcquisition.status, "passed");
  assert.equal(checked.structuredContent.checks.inference.status, "unverified");
  assert.equal(checked.structuredContent.authIdentity.expectedLogin, "fixture-user");
  assert.equal(checked.structuredContent.authIdentity.authSource, "user");
  assert.equal(checked.structuredContent.authIdentity.copilotPlan, "enterprise");
  assert.equal(state.pins, 1);
  assert.equal(state.requests, 0);
});

test("Copilot uncertain outcomes survive restart and never replay a POST", async t => {
  const { load, factory, fetcher, state } = await setup(t);
  const operation_id = randomUUID();
  const uncertainFetch = async () => {
    state.requests++;
    throw Object.assign(new Error("private-reset"), { code: "ECONNRESET" });
  };
  const tools = imageTools(load, uncertainFetch, factory, "copilot");
  const first = await tools[0].invoke({ operation_id, prompt: "A synthetic robot" }, signal);
  assert.equal(first.structuredContent.error.outcome, "unknown");
  assert.equal(state.requests, 1);
  const restarted = imageTools(load, fetcher, factory, "copilot");
  const replay = await restarted[0].invoke({ operation_id, prompt: "A synthetic robot" }, signal);
  assert.equal(replay.structuredContent.error.code, "outcome_unknown");
  assert.equal(state.requests, 1);
});
