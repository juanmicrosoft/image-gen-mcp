import { z } from "zod";
import { MAX_IMAGE_BYTES, validatePng } from "./artifacts.js";
import { apiVersion } from "./capabilities.js";
import { credentialFailure, type Configuration } from "./config.js";
import { ImageError, normalizeError, parseUsage, providerError } from "./errors.js";

export interface ImageRequest {
  prompt: string;
  size: "1536x864";
  quality: "high";
}
const MAX_RESPONSE_BYTES = 32 * 1024 * 1024;
const responseSchema = z.object({
  data: z.array(z.object({ b64_json: z.string().min(1) })).length(1),
  output_format: z.literal("png").optional(),
  quality: z.literal("high").optional(),
  size: z.string().optional(),
  usage: z.unknown().optional(),
});

async function readResponse(response: Response): Promise<unknown> {
  if (!response.body) {
    if (!response.ok) return null;
    throw new ImageError("provider_output", "Azure returned an empty response; charges may apply.");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new ImageError("provider_output", "Azure response exceeded the local limit; charges may apply.");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch {
    if (!response.ok) return null;
    throw new ImageError("provider_output", "Azure returned invalid JSON; charges may apply.");
  }
}

async function requestImage(
  config: Configuration, input: ImageRequest, signal: AbortSignal, fetcher: typeof fetch = fetch,
  source?: Buffer,
) {
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(180_000)]);
  let headers: Record<string, string>;
  try {
    deadline.throwIfAborted();
    headers = await config.headers(deadline);
    deadline.throwIfAborted();
  } catch (cause) {
    const failure = credentialFailure(cause, deadline);
    throw new ImageError("authentication", `Credential acquisition failed before image submission. ${failure.message}`, true, null, failure.reason);
  }
  let response: Response;
  try {
    const fields = { ...input, n: 1, output_format: "png" };
    let body: string | FormData;
    if (source) {
      body = new FormData();
      for (const [key, value] of Object.entries(fields)) body.set(key, String(value));
      body.set("image", new Blob([new Uint8Array(source)], { type: "image/png" }), "reference.png");
    } else {
      body = JSON.stringify(fields);
      headers["content-type"] = "application/json";
    }
    response = await fetcher(`${config.endpoint}openai/deployments/${encodeURIComponent(config.deployment)}/images/${source ? "edits" : "generations"}?api-version=${apiVersion}`, {
      method: "POST", redirect: "error", signal: deadline,
      headers, body,
    });
    const raw = await readResponse(response);
    const header = response.headers.get("x-ms-request-id") ?? response.headers.get("x-request-id");
    const requestId = header && /^[\w.-]{1,128}$/.test(header) ? header : null;
    if (!response.ok) {
      const error = z.object({ error: z.object({ code: z.string().optional() }) }).safeParse(raw);
      throw providerError(response.status, error.success ? error.data.error.code : undefined, requestId);
    }
    const parsed = responseSchema.safeParse(raw);
    if (!parsed.success || (parsed.data.size !== undefined && parsed.data.size !== input.size)) {
      throw new ImageError("provider_output", "Azure returned an unsupported response shape or dimensions; charges may apply.", false, requestId);
    }
    const encoded = parsed.data.data[0]!.b64_json;
    if (encoded.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4) {
      throw new ImageError("provider_output", "Azure image exceeds the local byte limit; charges may apply.", false, requestId);
    }
    const bytes = Buffer.from(encoded, "base64");
    if (bytes.toString("base64") !== encoded) {
      throw new ImageError("provider_output", "Azure returned invalid image encoding; charges may apply.", false, requestId);
    }
    try {
      const dimensions = await validatePng(bytes);
      if (`${dimensions.width}x${dimensions.height}` !== input.size) throw new Error("Dimensions differ.");
    } catch {
      throw new ImageError("provider_output", "Azure image is invalid or differs from requested dimensions; charges may apply.", false, requestId);
    }
    return { bytes, requestId, usage: parseUsage(parsed.data.usage) };
  } catch (error) {
    throw normalizeError(error);
  }
}

export function generate(config: Configuration, input: ImageRequest, signal: AbortSignal, fetcher: typeof fetch = fetch) {
  return requestImage(config, input, signal, fetcher);
}

export function edit(config: Configuration, input: ImageRequest, source: Buffer, signal: AbortSignal, fetcher: typeof fetch = fetch) {
  return requestImage(config, input, signal, fetcher, source);
}
