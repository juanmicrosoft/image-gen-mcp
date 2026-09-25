import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { CredentialFailureReason } from "./config.js";

export const errorCodes = [
  "invalid_input", "authentication", "permission", "deployment", "policy", "quota",
  "throttled", "network", "timeout", "provider_output", "persistence", "service",
  "busy", "conflict", "outcome_unknown", "previous_failure", "internal",
] as const;
export type ErrorCode = typeof errorCodes[number];

export class ImageError extends Error {
  readonly requestId: string | null;
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly knownFailure = false,
    requestId?: string | null,
    readonly authReason?: CredentialFailureReason,
  ) {
    super(message);
    this.requestId = requestId && /^[\w.-]{1,128}$/.test(requestId) ? requestId : null;
  }
}

export function providerError(status: number, providerCode: unknown, requestId?: string | null): ImageError {
  const code = typeof providerCode === "string" ? providerCode.toLowerCase() : "";
  if (["contentfilter", "content_filter", "content_policy_violation", "responsibleaipolicyviolation"].includes(code)) {
    return new ImageError("policy", "Azure rejected this content. No rewrite, fallback or retry was attempted.", true, requestId);
  }
  if (status === 403 || code === "permissiondenied") {
    return new ImageError("permission", "Inference permission denied. Check tenant and resource-scoped inference role; management access is not sufficient.", true, requestId);
  }
  if (status === 401) return new ImageError("authentication", "Authentication failed. Check the explicitly selected credential and tenant.", true, requestId);
  if (status === 404) return new ImageError("deployment", "Inference endpoint or deployment was not found. Verify both configuration values.", true, requestId);
  if (status === 429) {
    return new ImageError(code.includes("quota") ? "quota" : "throttled",
      "Azure declined this request due to quota or throttling. Inspect limits before explicitly choosing a new operation ID; no automatic retry.", true, requestId);
  }
  if (status === 400 || status === 422) return new ImageError("invalid_input", "Azure rejected the options or input. Check the configured model capability profile.", true, requestId);
  return new ImageError("service", "Azure service failure; completion and billing may be unknown. Inspect operation status before taking further action.", false, requestId);
}

export function normalizeError(error: unknown): ImageError {
  if (error instanceof ImageError) return error;
  if (error instanceof z.ZodError) return new ImageError("invalid_input", "Invalid tool arguments or configuration.", true);
  if (error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name)) {
    return new ImageError("timeout", "Request interrupted. Azure may still be processing or billing it. Inspect the existing operation; do not resubmit automatically.");
  }
  const transportCodes = new Set(["ECONNRESET", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN",
    "ENETUNREACH", "EHOSTUNREACH", "ETIMEDOUT", "UND_ERR_SOCKET", "UND_ERR_CONNECT_TIMEOUT"]);
  let cause: unknown = error;
  for (let depth = 0; depth < 3 && typeof cause === "object" && cause !== null; depth++) {
    if ("code" in cause && typeof cause.code === "string" && transportCodes.has(cause.code)) {
      return new ImageError("network", "Network transport failed. Upstream processing and charges may still occur; inspect this operation before any explicit new submission.");
    }
    cause = "cause" in cause ? cause.cause : null;
  }
  if (error instanceof Error && "code" in error) {
    if (["busy", "conflict", "outcome_unknown", "previous_failure"].includes(String(error.code))) {
      const schema = z.enum(["busy", "conflict", "outcome_unknown", "previous_failure"]);
      const code = schema.parse(error.code);
      return new ImageError(code, code === "outcome_unknown"
        ? "Upstream processing may continue and charges may apply. Inspect the stored operation; automatic resubmission is unsafe."
        : "Operation cannot be submitted. Inspect its stored state and arguments; no automatic resubmission.");
    }
    if (["ENOSPC", "EACCES", "EPERM", "EIO", "EROFS", "ENOENT", "EEXIST"].includes(String(error.code))) {
      return new ImageError("persistence", "Local file access or persistence failed. A provider request may already have completed; inspect the operation/artifacts.");
    }
  }
  return new ImageError("internal", "Operation failed unexpectedly. Inspect the existing operation and sanitized diagnostics; no automatic retry.");
}

export function errorResult(error: unknown): CallToolResult {
  const safe = normalizeError(error);
  const details = {
    code: safe.code, message: safe.message, requestId: safe.requestId,
    outcome: safe.knownFailure ? "failed" : "unknown",
    automaticRetry: false,
    billing: "unknown",
    ...(safe.authReason ? { authReason: safe.authReason } : {}),
  };
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify({ error: details }) }],
    structuredContent: { error: details },
  };
}

export const usageSchema = z.object({
  input_tokens: z.number().int().nonnegative().optional(),
  output_tokens: z.number().int().nonnegative().optional(),
  total_tokens: z.number().int().nonnegative().optional(),
});
export type Usage = z.infer<typeof usageSchema> | null;
export function parseUsage(value: unknown): Usage {
  if (value === undefined || value === null) return null;
  const result = usageSchema.safeParse(value);
  if (!result.success) throw new ImageError("provider_output", "Azure returned invalid usage metadata; the request may already have incurred charges.");
  return Object.keys(result.data).length ? result.data : null;
}
