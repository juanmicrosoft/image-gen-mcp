import { CopilotClient, CopilotRequestHandler, RuntimeConnection, type CopilotClientOptions, type CopilotRequestContext } from "@github/copilot-sdk";
import { mkdtemp, writeFile, unlink, rmdir, realpath } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { MAX_IMAGE_BYTES, validatePng } from "./artifacts.js";
import type { CopilotConfiguration } from "./config.js";
import { ImageError, normalizeError, parseUsage, providerError, type Usage } from "./errors.js";
import { readResponse, type ImageRequest } from "./provider.js";

type Client = Pick<CopilotClient, "start" | "getStatus" | "getAuthStatus" | "createSession" | "deleteSession" | "stop">;
export type CopilotClientFactory = (options: CopilotClientOptions) => Client;
const createClient: CopilotClientFactory = (options) => new CopilotClient(options);
const copilotApiOrigins = new Set([
  "https://api.githubcopilot.com",
  "https://api.individual.githubcopilot.com",
  "https://api.business.githubcopilot.com",
  "https://api.enterprise.githubcopilot.com",
]);
const responseSchema = z.object({
  data: z.array(z.object({ b64_json: z.string().min(1) })).length(1),
  size: z.string(),
  quality: z.enum(["low", "medium", "high"]),
  output_format: z.literal("png"),
  usage: z.unknown().optional(),
  copilot_usage: z.object({
    total_nano_aiu: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
    token_details: z.array(z.object({ model: z.string().min(1).max(128) })).optional(),
  }).optional(),
});
export interface CopilotImageResult {
  bytes: Buffer;
  size: string;
  quality: "low" | "medium" | "high" | "auto";
  model: string;
  modelEvidence: "observed" | "unverified";
  requestId: string | null;
  usage: Usage;
  authSource: "user";
  copilotPlan?: string;
}
export interface CopilotIdentity {
  login: string;
  host: string;
  authSource: "user";
  copilotPlan?: string;
}

async function withAbort<T>(promise: Promise<T>, signal: AbortSignal, onAbort?: () => Promise<unknown>): Promise<T> {
  signal.throwIfAborted();
  let rejectAbort: ((reason?: unknown) => void) | undefined;
  const aborted = new Promise<never>((_resolve, reject) => { rejectAbort = reject; });
  const listener = () => {
    if (onAbort) void onAbort().catch(() => {});
    rejectAbort!(signal.reason);
  };
  signal.addEventListener("abort", listener, { once: true });
  try {
    return await Promise.race([promise, aborted]);
  } finally {
    signal.removeEventListener("abort", listener);
  }
}

async function checkIdentity(
  client: Client,
  config: CopilotConfiguration,
  signal: AbortSignal,
): Promise<{ login: string; host: string }> {
  const auth = await withAbort(client.getAuthStatus(), signal);
  signal.throwIfAborted();
  if (!auth.isAuthenticated || auth.authType !== "user" || !auth.host ||
      auth.login?.toLowerCase() !== config.expectedLogin.toLowerCase()) {
    throw new ImageError("authentication", "Copilot must be signed in with the expected local OAuth user. CLI/environment token modes cannot be pinned without exposing credentials, so no image request was attempted.", true);
  }
  return { login: auth.login, host: auth.host };
}

async function checkSessionIdentity(
  session: Awaited<ReturnType<Client["createSession"]>>,
  config: CopilotConfiguration,
  expectedHost: string,
  signal: AbortSignal,
): Promise<CopilotIdentity> {
  const auth = await withAbort(session.rpc.gitHubAuth.getStatus(), signal, () => session.abort());
  signal.throwIfAborted();
  if (!auth.isAuthenticated || auth.authType !== "user" || auth.host !== expectedHost ||
      auth.login?.toLowerCase() !== config.expectedLogin.toLowerCase()) {
    throw new ImageError("authentication", "The isolated Copilot session is not pinned to the expected local OAuth user. No image request was forwarded and no account switch was attempted.", true);
  }
  const plan = z.string().min(1).max(128).safeParse(auth.copilotPlan);
  return {
    login: auth.login, host: auth.host, authSource: "user",
    ...(plan.success ? { copilotPlan: plan.data } : {}),
  };
}

async function pinSessionIdentity(
  session: Awaited<ReturnType<Client["createSession"]>>,
  config: CopilotConfiguration,
  expectedHost: string,
  signal: AbortSignal,
): Promise<CopilotIdentity> {
  const active = await withAbort(session.rpc.accounts.get({ query: { kind: "activeAccount" } }), signal, () => session.abort());
  const auth = active.kind === "activeAccount" ? active.authInfo : undefined;
  if (auth?.type !== "user" || auth.host !== expectedHost || !auth.copilotUser ||
      auth.login?.toLowerCase() !== config.expectedLogin.toLowerCase()) {
    throw new ImageError("authentication", "Copilot's active session identity cannot be pinned as the expected local OAuth user without reading a token. No image request was attempted.", true);
  }
  const pinned = await withAbort(session.rpc.gitHubAuth.setCredentials({
    credentials: {
      type: "user", host: auth.host, login: auth.login, copilotUser: auth.copilotUser,
    },
  }), signal, () => session.abort());
  if (!pinned.success || pinned.copilotUserResolved !== true) {
    throw new ImageError("authentication", "Copilot did not confirm the credential-free session identity pin. No image request was attempted.", true);
  }
  return checkSessionIdentity(session, config, expectedHost, signal);
}

function clientOptions(config: CopilotConfiguration): CopilotClientOptions {
  return {
    connection: RuntimeConnection.forStdio(config.cliPath ? { path: config.cliPath } : undefined),
    logLevel: "error", useLoggedInUser: true,
  };
}

export async function checkCopilotIdentity(
  config: CopilotConfiguration, signal: AbortSignal, factory: CopilotClientFactory = createClient,
): Promise<CopilotIdentity> {
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(30_000)]);
  const client = factory(clientOptions(config));
  let failure: unknown;
  let identity: CopilotIdentity | undefined;
  let session: Awaited<ReturnType<Client["createSession"]>> | undefined;
  try {
    await withAbort(client.start(), deadline);
    const expected = await checkIdentity(client, config, deadline);
    session = await withAbort(client.createSession({
      availableTools: [], enableConfigDiscovery: false, enableSkills: false,
      enableSessionStore: false, skipCustomInstructions: true, enableSessionTelemetry: false,
      mcpServers: {}, onPermissionRequest: () => ({ kind: "reject" }),
    }), deadline);
    identity = await pinSessionIdentity(session, config, expected.host, deadline);
  } catch (error) {
    failure = error instanceof ImageError ? error :
      new ImageError("authentication", "Copilot runtime or authentication could not be checked. Verify the installed runtime and intended account; no inference was requested.", true);
  } finally {
    if (session) {
      try { await withAbort(session.disconnect(), deadline); } catch {
        if (!failure) failure = new ImageError("internal", "Copilot diagnostic session did not stop cleanly.", true);
      }
      try { await withAbort(client.deleteSession(session.sessionId), deadline); } catch {
        if (!failure) failure = new ImageError("internal", "Copilot diagnostic session did not stop cleanly.", true);
      }
    }
    try {
      if ((await withAbort(client.stop(), deadline)).length && !failure) {
        failure = new ImageError("internal", "Copilot diagnostic runtime did not stop cleanly.", true);
      }
    } catch {
      if (!failure) failure = new ImageError("internal", "Copilot diagnostic runtime did not stop cleanly.", true);
    }
  }
  if (failure) throw failure;
  return identity!;
}

export async function requestCopilotImage(
  config: CopilotConfiguration, input: ImageRequest, signal: AbortSignal, source?: Buffer,
  factory: CopilotClientFactory = createClient, fetcher: typeof fetch = fetch,
): Promise<CopilotImageResult> {
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(180_000)]);
  if (deadline.aborted) {
    throw new ImageError("timeout", "Request was interrupted before Copilot image submission.", true);
  }
  let client: Client;
  let result: CopilotImageResult | undefined;
  let failure: unknown;
  let submitted = false;
  let postReserved = false;
  let invocationActive = false;
  let sessionIdentity: CopilotIdentity | undefined;
  let expectedHost: string | undefined;
  const route = source ? "/v1/images/edits" : "/v1/images/generations";
  class OneImageRequest extends CopilotRequestHandler {
    override async sendRequest(request: Request, context: CopilotRequestContext): Promise<Response> {
      try {
        const url = new URL(request.url);
        const requestSignal = AbortSignal.any([deadline, context.signal]);
        requestSignal.throwIfAborted();
        if (!session || (context.sessionId !== undefined && context.sessionId !== session.sessionId)) {
          throw new ImageError("authentication", "Copilot request identity belongs to another session; no request was forwarded.", true);
        }
        if (!copilotApiOrigins.has(url.origin)) {
          throw new ImageError("permission", "Copilot requested an unexpected service origin; no request was forwarded.", !submitted);
        }
        if (url.username || url.password || url.search || url.hash) {
          throw new ImageError("permission", "Copilot requested credentials, query parameters or a fragment outside the reviewed native route; no request was forwarded.", !submitted);
        }
        if (request.method === "GET" && url.pathname === "/models") {
          if (!expectedHost) throw new ImageError("authentication", "Copilot session identity was not established.", true);
          sessionIdentity = await checkSessionIdentity(session, config, expectedHost, requestSignal);
          return await fetcher(request, { signal: requestSignal, redirect: "error" });
        }
        if (request.method !== "POST" || url.pathname !== route) {
          throw new ImageError("permission", "Only one native image request is permitted. Chat inference, automatic retries and other endpoints are blocked.", !submitted);
        }
        if (!invocationActive) {
          throw new ImageError("authentication", "Copilot image transport was invoked outside the owned native-tool execution; no request was forwarded.", true);
        }
        if (postReserved) {
          throw new ImageError("permission", "A native image request is already reserved. Concurrent callbacks and retries are blocked.", !submitted);
        }
        postReserved = true;
        if (!expectedHost) throw new ImageError("authentication", "Copilot session identity was not established.", true);
        sessionIdentity = await checkSessionIdentity(session, config, expectedHost, requestSignal);
        if (failure) throw failure;
        if (!invocationActive) {
          throw new ImageError("authentication", "Copilot image transport closed before forwarding; no request was sent.", true);
        }
        requestSignal.throwIfAborted();
        submitted = true;
        const response = await fetcher(request, { signal: requestSignal, redirect: "error" });
        const raw = await readResponse(response, "Copilot", requestSignal);
        const requestId = response.headers.get("x-request-id");
        if (!response.ok) {
          const providerCode = z.object({ error: z.object({ code: z.string().optional() }) }).safeParse(raw);
          throw providerError(response.status, providerCode.success ? providerCode.data.error.code : undefined, requestId, "Copilot");
        }
        const parsed = responseSchema.safeParse(raw);
        if (!parsed.success) throw new ImageError("provider_output", "Copilot returned unsupported image metadata; charges may apply.");
        const data = parsed.data;
        const encoded = data.data[0]!.b64_json;
        if (encoded.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4) {
          throw new ImageError("provider_output", "Copilot image exceeds the local byte limit; charges may apply.");
        }
        const bytes = Buffer.from(encoded, "base64");
        if (bytes.toString("base64") !== encoded) throw new ImageError("provider_output", "Copilot returned invalid image encoding; charges may apply.");
        let dimensions;
        try { dimensions = await withAbort(validatePng(bytes), requestSignal); } catch {
          throw new ImageError("provider_output", "Copilot returned an invalid PNG; charges may apply.");
        }
        const size = `${dimensions.width}x${dimensions.height}`;
        if (data.size !== size || (input.size !== "auto" && input.size !== size) ||
            (input.quality !== "auto" && data.quality !== input.quality)) {
          throw new ImageError("provider_output", "Copilot output differs from the requested or reported options; charges may apply.");
        }
        const models = [...new Set(data.copilot_usage?.token_details?.map(item => item.model))];
        const model = models.length === 1 ? models[0]! : "unknown";
        const nano = data.copilot_usage?.total_nano_aiu;
        const usage = parseUsage(data.usage, "Copilot");
        result = {
          bytes, size, quality: data.quality, model,
          modelEvidence: models.length === 1 ? "observed" : "unverified",
          requestId: requestId && /^[\w.-]{1,128}$/.test(requestId) ? requestId : null,
          usage: nano === undefined ? usage : { ...usage, ai_credits: nano / 1e9 },
          authSource: "user",
          ...(sessionIdentity?.copilotPlan ? { copilotPlan: sessionIdentity.copilotPlan } : {}),
        };
        return Response.json(raw, { status: response.status });
      } catch (error) {
        failure = error;
        throw error;
      }
    }
    override async openWebSocket(): Promise<never> {
      throw new ImageError("permission", "Websocket model inference is not permitted by the image backend.", !submitted);
    }
  }
  client = factory({ ...clientOptions(config), requestHandler: new OneImageRequest() });
  let session: Awaited<ReturnType<Client["createSession"]>> | undefined;
  let temporary: string | undefined;
  let reference: string | undefined;
  let approvedReference: string | undefined;
  try {
    await withAbort(client.start(), deadline);
    const status = await withAbort(client.getStatus(), deadline);
    const version = /^(\d+)\.(\d+)\.(\d+)$/.exec(status.version)?.slice(1).map(Number);
    if (!version || version[0]! < 1 || (version[0] === 1 && version[1] === 0 && version[2]! < 96)) {
      throw new ImageError("invalid_input", "Copilot runtime 1.0.96 or newer is required for this experimental image backend.", true);
    }
    expectedHost = (await checkIdentity(client, config, deadline)).host;
    if (source) {
      await withAbort(validatePng(source), deadline);
      temporary = await mkdtemp(join(config.outputRoot, ".copilot-reference-"));
      reference = join(temporary, "reference.png");
      await writeFile(reference, source, { mode: 0o600, flag: "wx" });
      approvedReference = await realpath(reference);
    }
    let toolPermissionGranted = false;
    session = await withAbort(client.createSession({
      imageGeneration: { enabled: true }, availableTools: ["image_generation"],
      enableConfigDiscovery: false, enableSkills: false, enableSessionStore: false,
      skipCustomInstructions: true, enableSessionTelemetry: false, mcpServers: {},
      onPermissionRequest: (request, invocation) => {
        if (deadline.aborted || !invocationActive || invocation.sessionId !== session?.sessionId) return { kind: "reject" };
        if (request.kind === "custom-tool" && request.toolName === "image_generation" &&
            request.managedApprovalRequired !== true && !toolPermissionGranted) {
          toolPermissionGranted = true;
          return { kind: "approve-once" };
        }
        if (request.kind === "read" && request.managedApprovalRequired === false &&
            approvedReference !== undefined && request.path === approvedReference) {
          return { kind: "approve-once" };
        }
        return { kind: "reject" };
      },
    }), deadline);
    sessionIdentity = await pinSessionIdentity(session, config, expectedHost, deadline);
    await withAbort(session.rpc.tools.initializeAndValidate(), deadline);
    deadline.throwIfAborted();
    const metadata = await withAbort(session.rpc.tools.getCurrentMetadata(), deadline);
    if (!metadata.tools?.some(tool => tool.name === "image_generation")) {
      throw new ImageError("permission", "Native image generation is unavailable for this runtime/account/policy. No alternate backend was attempted.", true);
    }
    let toolResult;
    invocationActive = true;
    try {
      toolResult = await withAbort(session.rpc.tools.execute({
        name: "image_generation",
        arguments: {
          prompt: input.prompt,
          ...(input.size !== "auto" ? { size: input.size } : {}),
          ...(input.quality !== "auto" ? { quality: input.quality } : {}),
          ...(reference ? { input_images: [{ path: reference }] } : {}),
        },
      }), deadline, () => session!.abort());
    } finally {
      invocationActive = false;
    }
    if (failure) throw failure;
    if (typeof toolResult === "string" || toolResult.resultType !== "success" || !result) {
      throw new ImageError("provider_output", "Native Copilot image tool did not return a verified successful image. Inspect the operation; no retry was attempted.", !submitted);
    }
  } catch (error) {
    const cause = failure ?? error;
    if (!submitted) {
      if (cause instanceof ImageError) {
        failure = cause;
      } else if (deadline.aborted || (cause instanceof Error && ["AbortError", "TimeoutError"].includes(cause.name))) {
        failure = new ImageError("timeout", "Request was interrupted before Copilot image submission.", true);
      } else {
        failure = new ImageError("service", "Copilot runtime setup failed before image submission. Verify the runtime and intended account.", true);
      }
    } else {
      failure = normalizeError(cause, "Copilot");
    }
  } finally {
    const cleanup: Promise<unknown>[] = [];
    if (session) {
      cleanup.push((async () => {
        const disconnected = await Promise.allSettled([withAbort(session.disconnect(), deadline)]);
        const deleted = await Promise.allSettled([withAbort(client.deleteSession(session.sessionId), deadline)]);
        if ([...disconnected, ...deleted].some(item => item.status === "rejected")) throw new Error("session cleanup");
      })());
    }
    if (reference) cleanup.push(withAbort(unlink(reference), deadline));
    const settled = await Promise.allSettled(cleanup);
    if (temporary) {
      try { await withAbort(rmdir(temporary), deadline); } catch {
        settled.push({ status: "rejected", reason: "reference cleanup" });
      }
    }
    let stopFailed = false;
    try { stopFailed = (await withAbort(client.stop(), deadline)).length > 0; } catch { stopFailed = true; }
    if ((stopFailed || settled.some(item => item.status === "rejected")) && !failure) {
      failure = new ImageError("internal", "Copilot runtime or temporary-file cleanup failed. Inspect the retained operation; no retry was attempted.", !submitted);
    }
  }
  if (failure) throw failure;
  return result!;
}
