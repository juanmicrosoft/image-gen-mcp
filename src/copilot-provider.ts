import { CopilotClient, CopilotRequestHandler, RuntimeConnection, type CopilotClientOptions, type CopilotRequestContext } from "@github/copilot-sdk";
import { mkdtemp, writeFile, unlink, rmdir } from "node:fs/promises";
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

async function checkIdentity(client: Client, config: CopilotConfiguration, signal: AbortSignal): Promise<string> {
  const auth = await withAbort(client.getAuthStatus(), signal);
  signal.throwIfAborted();
  if (!auth.isAuthenticated || auth.login?.toLowerCase() !== config.expectedLogin.toLowerCase()) {
    throw new ImageError("authentication", "Copilot is not signed in to IMAGE_GEN_COPILOT_LOGIN. Select the intended account yourself; no account switch or alternate credential was attempted.", true);
  }
  return auth.login;
}

function clientOptions(config: CopilotConfiguration): CopilotClientOptions {
  return {
    ...(config.cliPath ? { connection: RuntimeConnection.forStdio({ path: config.cliPath }) } : {}),
    logLevel: "error", useLoggedInUser: true,
  };
}

export async function checkCopilotIdentity(
  config: CopilotConfiguration, signal: AbortSignal, factory: CopilotClientFactory = createClient,
): Promise<string> {
  const client = factory(clientOptions(config));
  let failure: unknown;
  let login: string | undefined;
  try {
    await withAbort(client.start(), signal);
    login = await checkIdentity(client, config, signal);
  } catch (error) {
    failure = error instanceof ImageError ? error :
      new ImageError("authentication", "Copilot runtime or authentication could not be checked. Verify the installed runtime and intended account; no inference was requested.", true);
  } finally {
    try {
      if ((await client.stop()).length && !failure) {
        failure = new ImageError("internal", "Copilot diagnostic runtime did not stop cleanly.", true);
      }
    } catch {
      if (!failure) failure = new ImageError("internal", "Copilot diagnostic runtime did not stop cleanly.", true);
    }
  }
  if (failure) throw failure;
  return login!;
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
  const route = source ? "/v1/images/edits" : "/v1/images/generations";
  class OneImageRequest extends CopilotRequestHandler {
    override async sendRequest(request: Request, context: CopilotRequestContext): Promise<Response> {
      try {
        const url = new URL(request.url);
        const requestSignal = AbortSignal.any([deadline, context.signal]);
        requestSignal.throwIfAborted();
        if (!copilotApiOrigins.has(url.origin)) {
          throw new ImageError("permission", "Copilot requested an unexpected service origin; no request was forwarded.", !submitted);
        }
        if (request.method === "GET" && url.pathname === "/models") {
          return await fetcher(request, { signal: requestSignal, redirect: "error" });
        }
        if (request.method !== "POST" || url.pathname !== route || submitted) {
          throw new ImageError("permission", "Only one native image request is permitted. Chat inference, automatic retries and other endpoints are blocked.", !submitted);
        }
        await checkIdentity(client, config, requestSignal);
        requestSignal.throwIfAborted();
        submitted = true;
        const response = await fetcher(request, { signal: requestSignal, redirect: "error" });
        const raw = await readResponse(response, "Copilot");
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
        try { dimensions = await validatePng(bytes); } catch {
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
  try {
    await withAbort(client.start(), deadline);
    const status = await withAbort(client.getStatus(), deadline);
    const version = /^(\d+)\.(\d+)\.(\d+)$/.exec(status.version)?.slice(1).map(Number);
    if (!version || version[0]! < 1 || (version[0] === 1 && version[1] === 0 && version[2]! < 96)) {
      throw new ImageError("invalid_input", "Copilot runtime 1.0.96 or newer is required for this experimental image backend.", true);
    }
    await checkIdentity(client, config, deadline);
    if (source) {
      await validatePng(source);
      temporary = await mkdtemp(join(config.outputRoot, ".copilot-reference-"));
      reference = join(temporary, "reference.png");
      await writeFile(reference, source, { mode: 0o600, flag: "wx" });
    }
    let approved = false;
    session = await withAbort(client.createSession({
      imageGeneration: { enabled: true }, availableTools: ["image_generation"],
      enableConfigDiscovery: false, enableSkills: false, enableSessionStore: false,
      skipCustomInstructions: true, enableSessionTelemetry: false, mcpServers: {},
      onPermissionRequest: request => {
        const allow = request.kind === "custom-tool" && request.toolName === "image_generation" &&
          !request.managedApprovalRequired && !approved && !deadline.aborted;
        if (allow) approved = true;
        return { kind: allow ? "approved" : "denied-interactively-by-user" };
      },
    }), deadline);
    await withAbort(session.rpc.tools.initializeAndValidate(), deadline);
    deadline.throwIfAborted();
    const metadata = await withAbort(session.rpc.tools.getCurrentMetadata(), deadline);
    if (!metadata.tools?.some(tool => tool.name === "image_generation")) {
      throw new ImageError("permission", "Native image generation is unavailable for this runtime/account/policy. No alternate backend was attempted.", true);
    }
    const toolResult = await withAbort(session.rpc.tools.execute({
      name: "image_generation",
      arguments: {
        prompt: input.prompt,
        ...(input.size !== "auto" ? { size: input.size } : {}),
        ...(input.quality !== "auto" ? { quality: input.quality } : {}),
        ...(reference ? { input_images: [{ path: reference }] } : {}),
      },
    }), deadline, () => session!.abort());
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
        try { await session.disconnect(); } finally { await client.deleteSession(session.sessionId); }
      })());
    }
    if (reference) cleanup.push(unlink(reference));
    const settled = await Promise.allSettled(cleanup);
    if (temporary) {
      try { await rmdir(temporary); } catch {
        settled.push({ status: "rejected", reason: "reference cleanup" });
      }
    }
    let stopFailed = false;
    try { stopFailed = (await client.stop()).length > 0; } catch { stopFailed = true; }
    if ((stopFailed || settled.some(item => item.status === "rejected")) && !failure) {
      failure = new ImageError("internal", "Copilot runtime or temporary-file cleanup failed. Inspect the retained operation; no retry was attempted.", !submitted);
    }
  }
  if (failure) throw failure;
  return result!;
}
