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
  const state = { creates: 0, executions: 0, gets: 0, posts: 0, stopped: 0, deleted: 0, disconnected: 0, aborted: 0 };
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
    return {
      start: async () => {},
      getStatus: async () => ({ version: options.version ?? "1.0.96", protocolVersion: 3 }),
      getAuthStatus: async () => ({
        isAuthenticated: options.authenticated ?? true,
        login: options.changedAccount && checks++ > 0 ? "other-user" : (options.login ?? "fixture-user"),
      }),
      stop: async () => {
        state.stopped++;
        if (options.stopThrows) throw new Error("private-stop-error");
        return options.cleanupErrors ?? [];
      },
      deleteSession: async () => {
        state.deleted++;
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
            if (options.disconnectError) throw new Error("private-disconnect-error");
          },
          rpc: { tools: {
            initializeAndValidate: async () => {},
            getCurrentMetadata: async () => ({ tools: options.noTool ? [] : [{ name: "image_generation" }] }),
            execute: async ({ name, arguments: args }) => {
              state.executions++;
              state.args = args;
              assert.equal(name, "image_generation");
              const permission = await sessionOptions.onPermissionRequest({ kind: "custom-tool", toolName: name });
              assert.equal(permission.kind, "approved");
              if (options.websocket) {
                await clientOptions.requestHandler.openWebSocket({
                  signal, transport: "websocket", url: "wss://api.githubcopilot.com/chat",
                  requestId: "fixture-websocket",
                });
              }
              if (options.metadataGet) {
                const metadataUrl = options.metadataUrl ?? "https://api.githubcopilot.com/models";
                await clientOptions.requestHandler.sendRequest(new Request(metadataUrl),
                  { signal, transport: "http", requestId: "fixture-models", url: metadataUrl });
              }
              const route = options.route ?? (args.input_images ? "/v1/images/edits" : "/v1/images/generations");
              const ctx = { signal, transport: "http",
                url: `${options.origin ?? "https://api.githubcopilot.com"}${route}`, requestId: "fixture-request" };
              const request = () => new Request(ctx.url, { method: "POST", body: "{}" });
              const response = await clientOptions.requestHandler.sendRequest(request(), ctx);
              await response.text();
              if (options.retry) await clientOptions.requestHandler.sendRequest(request(), ctx);
              if (options.toolError) return { resultType: "failure", textResultForLlm: "private-provider-error" };
              return { resultType: "success", textResultForLlm: "Generated" };
            },
          } },
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
  const { factory, fetcher, state } = fixture({ body: { ...responseBody, size: "1024x1024", quality: "high",
    data: [{ b64_json: (await sharp(png).resize(1024, 1024).png().toBuffer()).toString("base64") }] } });
  const result = await edit(config, { ...input, size: "1024x1024", quality: "high" }, png, signal, fetcher, factory);
  assert.equal(result.size, "1024x1024");
  assert.equal(state.args.size, "1024x1024");
  assert.equal(state.args.quality, "high");
  assert.equal(state.args.input_images.length, 1);
  assert.equal(typeof state.args.input_images[0].path, "string");
  assert.ok(state.args.input_images[0].path.startsWith(`${providerRoot}/.copilot-reference-`));
  assert.equal(state.posts, 1);
});

test("absent, mismatched and changed accounts refuse image transmission without another identity", async () => {
  for (const options of [{ authenticated: false }, { login: "other-user" }, { changedAccount: true }]) {
    const { factory, fetcher, state } = fixture(options);
    await assert.rejects(generate(config, input, signal, fetcher, factory), error => error.code === "authentication");
    assert.equal(state.posts, 0);
    assert.equal(state.stopped, 1);
  }
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
