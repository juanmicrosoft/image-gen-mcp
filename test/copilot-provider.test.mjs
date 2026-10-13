import assert from "node:assert/strict";
import test, { after } from "node:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { generate, edit } from "../dist/provider.js";
import { loadConfiguration } from "../dist/config.js";

const signal = new AbortController().signal;
const providerRoot = join(process.cwd(), ".copilot-provider-test-output");
await mkdir(providerRoot, { recursive: true, mode: 0o700 });
after(() => rm(providerRoot, { recursive: true, force: true }));
const config = {
  backend: "copilot", expectedLogin: "fixture-user", authMode: "copilot",
  outputRoot: providerRoot, inputRoots: [], preview: false,
};
const input = { prompt: "  Keep this prompt unchanged.  ", size: "auto", quality: "auto" };
const png = await sharp({ create: { width: 1312, height: 1199, channels: 3, background: "navy" } }).png().toBuffer();
const responseBody = {
  data: [{ b64_json: png.toString("base64") }], size: "1312x1199", output_format: "png", quality: "low",
  usage: { input_tokens: 32, output_tokens: 215, total_tokens: 247 },
  copilot_usage: { total_nano_aiu: 661000000, token_details: [{ model: "gpt-image-2.5-sunburst" }] },
};

export function fixture(options = {}) {
  const state = {
    creates: 0, executions: 0, gets: 0, posts: 0, stopped: 0, deleted: 0,
    disconnected: 0, aborted: 0, sessionChecks: 0, pins: 0, permissions: [],
  };
  const fetcher = async (request, init) => {
    if (request.method === "POST") state.posts++;
    if (request.method === "GET") state.gets++;
    assert.ok(init.signal instanceof AbortSignal);
    if (options.fetch) return options.fetch(request, init);
    return Response.json(options.body ?? responseBody, {
      status: options.status ?? 200,
      headers: options.headers,
    });
  };
  const factory = (clientOptions) => {
    let checks = 0;
    state.requestHandler = clientOptions.requestHandler;
    return {
      start: async () => {},
      getStatus: async () => ({ version: options.version ?? "1.0.96", protocolVersion: 3 }),
      getAuthStatus: async () => ({
        isAuthenticated: options.authenticated ?? true,
        authType: options.globalAuthType ?? "user",
        host: options.globalHost ?? "https://github.com",
        login: options.changedAccount && checks++ > 0 ? "other-user" : (options.login ?? "fixture-user"),
      }),
      stop: async () => {
        state.stopped++;
        if (options.stopNever) return new Promise(() => {});
        if (options.stopThrows) throw new Error("private-stop-error");
        return options.cleanupErrors ?? [];
      },
      deleteSession: async () => {
        state.deleted++;
        if (options.deleteNever) return new Promise(() => {});
        if (options.deleteError) throw new Error("private-delete-error");
      },
      createSession: async (sessionOptions) => {
        state.creates++;
        state.sessionOptions = sessionOptions;
        return {
          sessionId: "fixture-session",
          abort: async () => { state.aborted++; },
          disconnect: async () => {
            state.disconnected++;
            if (options.disconnectNever) return new Promise(() => {});
            if (options.disconnectError) throw new Error("private-disconnect-error");
          },
          rpc: {
            accounts: {
              get: async () => ({
                kind: "activeAccount",
                ...(options.noActiveAuth ? {} : { authInfo: {
                  type: options.activeAuthType ?? "user",
                  host: options.activeHost ?? "https://github.com",
                  login: options.activeLogin ?? options.login ?? "fixture-user",
                  copilotUser: options.noCopilotUser ? undefined : {
                    analytics_tracking_id: "fixture-tracking",
                    chat_enabled: true,
                    copilot_plan: "enterprise",
                    endpoints: { api: "https://api.enterprise.githubcopilot.com" },
                    login: options.activeLogin ?? options.login ?? "fixture-user",
                  },
                } }),
              }),
            },
            gitHubAuth: {
              setCredentials: async ({ credentials }) => {
                state.pins++;
                state.pinnedCredentials = credentials;
                return { success: options.pinFails !== true, copilotUserResolved: options.pinResolved !== false };
              },
              getStatus: async () => {
                state.sessionChecks++;
                return {
                  isAuthenticated: options.sessionAuthenticated ?? true,
                  authType: options.authType ?? "user",
                  host: options.sessionHost ?? "https://github.com",
                  login: options.changedAccount && state.sessionChecks > 1
                    ? "other-user"
                    : (options.sessionLogin ?? options.login ?? "fixture-user"),
                  copilotPlan: options.copilotPlan ?? "enterprise",
                };
              },
            },
            tools: {
              initializeAndValidate: async () => {},
              getCurrentMetadata: async () => ({ tools: options.noTool ? [] : [{ name: "image_generation" }] }),
              execute: async ({ name, arguments: args }) => {
                state.executions++;
                state.args = args;
                assert.equal(name, "image_generation");
                const invocation = {
                  sessionId: options.permissionSessionId ?? "fixture-session",
                  managedSettingsEnabled: options.managedSettingsEnabled ?? false,
                };
                const permission = await sessionOptions.onPermissionRequest(
                  { kind: "custom-tool", toolName: name, managedApprovalRequired: options.managedTool ?? false },
                  invocation,
                );
                state.permissions.push(permission);
                if (permission.kind !== "approve-once") {
                  return { resultType: "failure", textResultForLlm: "private-custom-tool-permission" };
                }
                if (args.input_images) {
                  const path = options.readPath ?? args.input_images[0].path;
                  const readPermission = await sessionOptions.onPermissionRequest({
                    kind: "read", path, resolvedPath: path,
                    managedApprovalRequired: options.managedRead ?? false,
                    intention: "Read selected image reference",
                  }, invocation);
                  state.permissions.push(readPermission);
                  if (readPermission.kind !== "approve-once") {
                    return {
                      resultType: "failure",
                      textResultForLlm: `private-read-permission ${path}`,
                    };
                  }
                  if (options.duplicateRead) {
                    const duplicate = await sessionOptions.onPermissionRequest({
                      kind: "read", path, resolvedPath: path, managedApprovalRequired: false,
                      intention: "Read selected image reference again",
                    }, invocation);
                    state.permissions.push(duplicate);
                    if (duplicate.kind !== "approve-once") {
                      return { resultType: "failure", textResultForLlm: "private-duplicate-read" };
                    }
                  }
                }
                if (options.skipPost) return { resultType: "success", textResultForLlm: "No request" };
                if (options.websocket) {
                  await clientOptions.requestHandler.openWebSocket({
                    signal, transport: "websocket", url: "wss://api.githubcopilot.com/chat",
                    requestId: "fixture-websocket",
                  });
                }
                if (options.metadataGet) {
                  const metadataUrl = options.metadataUrl ?? "https://api.githubcopilot.com/models";
                  await clientOptions.requestHandler.sendRequest(new Request(metadataUrl),
                    { signal, transport: "http", requestId: "fixture-models", url: metadataUrl,
                      ...(options.omitSessionId ? {} : { sessionId: options.requestSessionId ?? "fixture-session" }) });
                }
                const route = options.route ?? (args.input_images ? "/v1/images/edits" : "/v1/images/generations");
                const ctx = { signal, transport: "http",
                  url: `${options.origin ?? "https://api.githubcopilot.com"}${route}`, requestId: "fixture-request",
                  ...(options.omitSessionId ? {} : { sessionId: options.requestSessionId ?? "fixture-session" }) };
                const request = () => new Request(ctx.url, { method: "POST", body: "{}" });
                const response = await clientOptions.requestHandler.sendRequest(request(), ctx);
                await response.text();
                if (options.retry) await clientOptions.requestHandler.sendRequest(request(), ctx);
                if (options.toolError) return { resultType: "failure", textResultForLlm: "private-provider-error" };
                return { resultType: "success", textResultForLlm: "Generated" };
              },
            },
          },
        };
      },
    };
  };
  return { factory, fetcher, state };
}

test("explicit Copilot configuration needs no Azure settings but requires an expected account", () => {
  const env = { IMAGE_GEN_BACKEND: "copilot", IMAGE_GEN_COPILOT_LOGIN: "fixture-user", IMAGE_GEN_OUTPUT_DIR: config.outputRoot };
  const loaded = loadConfiguration(env, () => { throw new Error("Azure auth must not be instantiated"); });
  assert.equal(loaded.backend, "copilot");
  assert.equal(loaded.expectedLogin, "fixture-user");
  for (const patch of [
    { IMAGE_GEN_COPILOT_LOGIN: undefined }, { IMAGE_GEN_COPILOT_LOGIN: " user " },
    { IMAGE_GEN_BACKEND: "automatic" }, { IMAGE_GEN_COPILOT_CLI_PATH: "relative" },
    { AZURE_OPENAI_API_KEY: "private-key" }, { IMAGE_GEN_AUTH: "api-key" },
  ]) assert.throws(() => loadConfiguration({ ...env, ...patch }));
});

test("native generation preserves the prompt, records observed metadata and uses no chat turn", async () => {
  const { factory, fetcher, state } = fixture();
  const result = await generate(config, input, signal, fetcher, factory);
  assert.deepEqual(result.bytes, png);
  assert.equal(result.size, "1312x1199");
  assert.equal(result.quality, "low");
  assert.equal(result.model, "gpt-image-2.5-sunburst");
  assert.equal(result.usage.ai_credits, 0.661);
  assert.equal(result.authSource, "user");
  assert.equal(result.copilotPlan, "enterprise");
  assert.deepEqual(state.args, { prompt: input.prompt });
  assert.equal(state.posts, 1);
  assert.equal(state.deleted, 1);
  assert.equal(state.disconnected, 1);
  assert.equal(state.stopped, 1);
  assert.equal(state.sessionOptions.imageGeneration.enabled, true);
  assert.deepEqual(state.sessionOptions.availableTools, ["image_generation"]);
  assert.equal(state.sessionOptions.enableConfigDiscovery, false);
  assert.equal(state.sessionOptions.enableSessionStore, false);
});

test("edit hands only the explicit approved reference to the native tool and preserves requested options", async () => {
  const { factory, fetcher, state } = fixture({ duplicateRead: true,
    body: { ...responseBody, size: "1024x1024", quality: "high",
    data: [{ b64_json: (await sharp(png).resize(1024, 1024).png().toBuffer()).toString("base64") }] } });
  const result = await edit(config, { ...input, size: "1024x1024", quality: "high" }, png, signal, fetcher, factory);
  assert.equal(result.size, "1024x1024");
  assert.equal(state.args.size, "1024x1024");
  assert.equal(state.args.quality, "high");
  assert.equal(state.args.input_images.length, 1);
  assert.equal(typeof state.args.input_images[0].path, "string");
  assert.ok(state.args.input_images[0].path.startsWith(`${providerRoot}/.copilot-reference-`));
  assert.equal(state.permissions.length, 3);
  assert.equal(state.permissions[1].kind, "approve-once");
  assert.equal(state.permissions[2].kind, "approve-once");
  assert.equal(state.posts, 1);
});

test("edit rejects any read outside the exact staged reference or requiring managed approval before POST", async () => {
  for (const options of [
    { readPath: "/different/private-reference.png" },
    { managedRead: true },
    { permissionSessionId: "foreign-session" },
  ]) {
    const denied = fixture(options);
    await assert.rejects(edit(config, input, png, signal, denied.fetcher, denied.factory), error => {
      assert.equal(error.code, "provider_output");
      assert.equal(error.knownFailure, true);
      assert.doesNotMatch(error.message, /different|private-reference|private-read/);
      return true;
    });
    assert.equal(denied.state.posts, 0);
    assert.ok(denied.state.permissions.length >= 1);
    assert.equal(denied.state.permissions.at(-1).kind, "reject");
  }
});

test("exact staged reads are rejected outside the active owned invocation", async () => {
  const outside = fixture({ skipPost: true });
  await assert.rejects(edit(config, input, png, signal, outside.fetcher, outside.factory));
  const path = outside.state.args.input_images[0].path;
  const decision = await outside.state.sessionOptions.onPermissionRequest({
    kind: "read", path, resolvedPath: path, managedApprovalRequired: false,
    intention: "Read selected image reference after invocation",
  }, { sessionId: "fixture-session", managedSettingsEnabled: false });
  assert.equal(decision.kind, "reject");
  assert.equal(outside.state.posts, 0);
});

test("absent, mismatched and changed accounts refuse image transmission without another identity", async () => {
  for (const options of [
    { noActiveAuth: true },
    { activeAuthType: "gh-cli" },
    { activeAuthType: "env" },
    { activeLogin: "other-user" },
    { activeHost: "https://other.example" },
    { noCopilotUser: true },
    { pinFails: true },
    { pinResolved: false },
    { globalAuthType: "gh-cli" },
    { sessionAuthenticated: false },
    { changedAccount: true },
    { sessionLogin: "other-user" },
    { requestSessionId: "other-session" },
  ]) {
    const { factory, fetcher, state } = fixture(options);
    await assert.rejects(generate(config, input, signal, fetcher, factory), error => error.code === "authentication");
    assert.equal(state.posts, 0);
    assert.equal(state.stopped, 1);
  }
});

test("missing runtime sessionId is accepted only during the owned native invocation gate", async () => {
  const owned = fixture({ omitSessionId: true });
  await generate(config, input, signal, owned.fetcher, owned.factory);
  assert.equal(owned.state.posts, 1);
  const outside = fixture({ omitSessionId: true, skipPost: true });
  await assert.rejects(generate(config, input, signal, outside.fetcher, outside.factory));
  assert.equal(outside.state.posts, 0);
  const url = "https://api.githubcopilot.com/v1/images/generations";
  await assert.rejects(
    outside.state.requestHandler.sendRequest(new Request(url, { method: "POST", body: "{}" }),
      { signal, transport: "http", requestId: "outside-gate", url }),
    error => error.code === "authentication",
  );
  assert.equal(outside.state.posts, 0);
});

test("owned request session identity is attested twice with credential-free session metadata", async () => {
  const { factory, fetcher, state } = fixture();
  await generate(config, input, signal, fetcher, factory);
  assert.equal(state.pins, 1);
  assert.deepEqual(state.pinnedCredentials, {
    type: "user",
    host: "https://github.com",
    login: "fixture-user",
    copilotUser: {
      analytics_tracking_id: "fixture-tracking",
      chat_enabled: true,
      copilot_plan: "enterprise",
      endpoints: { api: "https://api.enterprise.githubcopilot.com" },
      login: "fixture-user",
    },
  });
  assert.equal("token" in state.pinnedCredentials, false);
  assert.equal(state.sessionChecks, 2);
  assert.equal(state.posts, 1);
});

test("unsupported runtime, missing native tool and pre-cancellation refuse submission", async () => {
  for (const options of [{ version: "1.0.95" }, { noTool: true }]) {
    const { factory, fetcher, state } = fixture(options);
    await assert.rejects(generate(config, input, signal, fetcher, factory));
    assert.equal(state.posts, 0);
    assert.equal(state.stopped, 1);
  }
  const { factory, fetcher, state } = fixture();
  await assert.rejects(generate(config, input, AbortSignal.abort(), fetcher, factory), error => {
    assert.equal(error.code, "timeout");
    assert.equal(error.knownFailure, true);
    return true;
  });
  assert.equal(state.creates, 0);
  assert.equal(state.posts, 0);
});

test("one-request guard prevents SDK retries, unrelated origins/routes and websocket forwarding", async () => {
  for (const options of [
    { retry: true }, { route: "/chat/completions" }, { route: "/v1/images/edits" },
    { origin: "https://example.githubcopilot.com" }, { websocket: true },
    { metadataGet: true, metadataUrl: "https://api.githubcopilot.com/private" },
    { route: "/v1/images/generations?unreviewed=1" },
    { route: "/v1/images/generations#unreviewed" },
    { origin: "https://user:password@api.githubcopilot.com" },
    { metadataGet: true, metadataUrl: "https://api.githubcopilot.com/models?unreviewed=1" },
    { metadataGet: true, metadataUrl: "https://api.githubcopilot.com/models#unreviewed" },
    { metadataGet: true, metadataUrl: "https://user:password@api.githubcopilot.com/models" },
  ]) {
    const { factory, fetcher, state } = fixture(options);
    await assert.rejects(generate(config, input, signal, fetcher, factory));
    assert.equal(state.posts, options.retry ? 1 : 0);
    assert.equal(state.stopped, 1);
  }
});

test("malformed outputs, missing auto metadata and private service errors stay failures", async () => {
  for (const options of [
    { body: {} }, { body: { ...responseBody, data: [{ url: "https://private.example/image.png" }] } },
    { body: { ...responseBody, data: [{ b64_json: "invalid" }] } },
    { body: { ...responseBody, output_format: "jpeg" } },
    { body: { ...responseBody, quality: "high" }, toolError: true },
    { body: { ...responseBody, size: "1024x1024" } },
    { body: { data: responseBody.data, size: responseBody.size } },
    { body: { data: responseBody.data, quality: responseBody.quality } },
    { body: { ...responseBody, usage: { total_tokens: -1 } } },
    { body: { ...responseBody, copilot_usage: { total_nano_aiu: -1 } } },
    { status: 500, body: { error: { message: "private-provider-error" } } },
  ]) {
    const { factory, fetcher, state } = fixture(options);
    await assert.rejects(generate(config, input, signal, fetcher, factory),
      error => !error.message.includes("private-provider-error") && !error.message.includes("private.example"));
    assert.equal(state.posts, 1);
    assert.equal(state.stopped, 1);
  }
});

test("missing usage/model stay unknown without fabricating output metadata", async () => {
  const { factory, fetcher } = fixture({ body: {
    data: responseBody.data, size: responseBody.size, quality: responseBody.quality, output_format: "png",
  } });
  const result = await generate(config, input, signal, fetcher, factory);
  assert.equal(result.usage, null);
  assert.equal(result.modelEvidence, "unverified");
  assert.equal(result.model, "unknown");
});

test("cancellation reaches the HTTP transport and cleanup still runs", async () => {
  const abort = new AbortController();
  const cancelled = fixture({ fetch: async (_request, init) => {
    abort.abort();
    init.signal.throwIfAborted();
  } });
  await assert.rejects(generate(config, input, abort.signal, cancelled.fetcher, cancelled.factory));
  assert.equal(cancelled.state.posts, 1);
  assert.equal(cancelled.state.stopped, 1);
});

test("bounded responses, policy failures and cleanup failures remain sanitized unknown outcomes", async () => {
  const oversized = fixture({ fetch: async () => new Response(new Uint8Array(32 * 1024 * 1024 + 1)) });
  await assert.rejects(generate(config, input, signal, oversized.fetcher, oversized.factory),
    error => error.code === "provider_output");
  assert.equal(oversized.state.posts, 1);

  const policy = fixture({
    status: 400,
    body: { error: { code: "content_policy_violation", message: "private-policy-detail" } },
    headers: { "x-request-id": "safe-request-id" },
  });

  await assert.rejects(generate(config, input, signal, policy.fetcher, policy.factory), error => {
    assert.equal(error.code, "policy");
    assert.equal(error.requestId, "safe-request-id");
    assert.match(error.message, /Copilot/);
    assert.doesNotMatch(error.message, /private-policy-detail|Azure/);
    return true;
  });

  for (const options of [{ cleanupErrors: [new Error("private")] }, { disconnectError: true }, { deleteError: true }, { stopThrows: true }]) {
    const failed = fixture(options);
    await assert.rejects(generate(config, input, signal, failed.fetcher, failed.factory), error => {
      assert.equal(error.code, "internal");
      assert.equal(error.knownFailure, false);
      assert.doesNotMatch(error.message, /private/);
      return true;
    });
    assert.equal(failed.state.posts, 1);
  }
});

test("response parsing and every cleanup stage settle at the operation deadline", async () => {
  const cases = [
    { fetch: async () => new Response(new ReadableStream({ start() {} })) },
    { disconnectNever: true },
    { deleteNever: true },
    { stopNever: true },
  ];
  for (const options of cases) {
    const pending = fixture(options);
    const outcome = await Promise.race([
      generate(config, input, AbortSignal.timeout(50), pending.fetcher, pending.factory)
        .then(() => "resolved", error => error),
      new Promise(resolve => setTimeout(() => resolve("still-pending"), 300)),
    ]);
    assert.notEqual(outcome, "still-pending");
    assert.notEqual(outcome, "resolved");
    assert.notEqual(outcome.knownFailure, true);
    assert.equal(pending.state.posts, 1);
  }
});

test("portable runtime is default, explicit runtime paths are passed through, and allowed metadata GET is nonbillable", async () => {
  let defaultOptions;
  const portable = fixture({ metadataGet: true, fetch: async request => {
    if (request.method === "GET") return Response.json({ data: [] });
    return Response.json(responseBody);
  } });
  const portableFactory = options => {
    defaultOptions = options;
    return portable.factory(options);
  };
  await generate(config, input, signal, portable.fetcher, portableFactory);
  assert.equal(defaultOptions.connection, undefined);
  assert.equal(portable.state.gets, 1);
  assert.equal(portable.state.posts, 1);

  let explicitOptions;
  const explicit = fixture();
  await generate({ ...config, cliPath: "/absolute/copilot" }, input, signal, explicit.fetcher, options => {
    explicitOptions = options;
    return explicit.factory(options);
  });
  assert.equal(explicitOptions.connection.kind, "stdio");
  assert.equal(explicitOptions.connection.path, "/absolute/copilot");
});

test("exact first-party plan origins are allowed while unknown Copilot subdomains stay blocked", async () => {
  for (const origin of [
    "https://api.githubcopilot.com",
    "https://api.individual.githubcopilot.com",
    "https://api.business.githubcopilot.com",
    "https://api.enterprise.githubcopilot.com",
  ]) {
    const allowed = fixture({
      origin,
      metadataGet: true,
      metadataUrl: `${origin}/models`,
      fetch: async request => request.method === "GET" ? Response.json({ data: [] }) : Response.json(responseBody),
    });
    await generate(config, input, signal, allowed.fetcher, allowed.factory);
    assert.equal(allowed.state.gets, 1);
    assert.equal(allowed.state.posts, 1);
  }

  const blocked = fixture({ origin: "https://api.unknown.githubcopilot.com" });
  await assert.rejects(generate(config, input, signal, blocked.fetcher, blocked.factory),
    error => error.code === "permission");
  assert.equal(blocked.state.posts, 0);
});
