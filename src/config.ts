import { AzureCliCredential } from "@azure/identity";
import { isAbsolute, resolve } from "node:path";
import { z } from "zod";
import { normalizeError } from "./errors.js";

export class ConfigurationError extends Error {}
export type CredentialFailureReason = "login_required" | "tenant_unavailable" | "session_expired" |
  "cli_unavailable" | "credential_timeout" | "cancelled" | "network" | "unknown";
const credentialMessages: Record<CredentialFailureReason, string> = {
  login_required: "Azure CLI requires sign-in. Run az login for the intended tenant; the SDK may combine missing and expired sessions into this result.",
  tenant_unavailable: "Azure reported that the requested tenant is unavailable or the account cannot sign in to it. Verify the intended tenant and account.",
  session_expired: "Azure reported an expired sign-in session. Sign in again to the intended tenant.",
  cli_unavailable: "Azure CLI could not be found. Install it and ensure the MCP process can locate az.",
  credential_timeout: "Azure CLI credential acquisition timed out. Check token acquisition separately before explicitly retrying.",
  cancelled: "Credential acquisition was cancelled. Inspect the operation before explicitly retrying.",
  network: "Credential acquisition encountered a network transport failure. Check connectivity before explicitly retrying.",
  unknown: "Azure CLI credential acquisition failed; its cause is unknown. Check login and the intended tenant.",
};
export class CredentialAcquisitionError extends ConfigurationError {
  constructor(readonly reason: CredentialFailureReason, cause: unknown) {
    super(`${credentialMessages[reason]} No fallback was attempted; no alternate credential was tried.`, { cause });
  }
}

export function credentialFailure(cause: unknown, signal?: AbortSignal): CredentialAcquisitionError {
  if (cause instanceof CredentialAcquisitionError) return cause;
  let reason: CredentialFailureReason = "unknown";
  const abortReason: unknown = signal?.aborted ? signal.reason : cause;
  if (abortReason instanceof Error && abortReason.name === "TimeoutError") reason = "credential_timeout";
  else if (signal?.aborted || (cause instanceof Error && cause.name === "AbortError")) reason = "cancelled";
  else if (normalizeError(cause).code === "network") reason = "network";
  else if (cause instanceof Error && cause.name === "CredentialUnavailableError") {
    const message = cause.message.slice(0, 16_384);
    if (/\bAADSTS(?:700082|700084|70043)\b/.test(message)) reason = "session_expired";
    else if (/\bAADSTS(?:90002|50020)\b/.test(message)) reason = "tenant_unavailable";
    else if (message.includes("Azure CLI could not be found.")) reason = "cli_unavailable";
    else if (message.includes("Please run 'az login' from a command prompt to authenticate before using this credential.")) reason = "login_required";
  }
  return new CredentialAcquisitionError(reason, cause);
}
export interface Configuration {
  endpoint: string;
  deployment: string;
  model: "gpt-image-2.5-sunburst";
  outputRoot: string;
  inputRoots: string[];
  authMode: "azure-cli" | "api-key";
  preview: boolean;
  headers(signal?: AbortSignal): Promise<Record<string, string>>;
}
interface CliCredential {
  getToken(scope: string, options?: { abortSignal?: AbortSignal }): Promise<{ token: string } | null>;
}
type CliFactory = (tenantId?: string) => CliCredential;

export function loadConfiguration(
  env: NodeJS.ProcessEnv = process.env,
  cliFactory: CliFactory = (tenantId) => new AzureCliCredential(tenantId ? { tenantId } : {}),
): Configuration {
  let endpoint: URL;
  try { endpoint = new URL(env.AZURE_OPENAI_ENDPOINT ?? ""); } catch {
    throw new ConfigurationError("Set AZURE_OPENAI_ENDPOINT to the Azure OpenAI inference resource root.");
  }
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password ||
      endpoint.port || endpoint.pathname !== "/" || endpoint.search || endpoint.hash ||
      !/^[a-z0-9][a-z0-9-]*\.openai\.azure\.com$/.test(endpoint.hostname)) {
    throw new ConfigurationError("Endpoint must be an HTTPS Azure OpenAI resource root, not a project URL, custom host or path.");
  }
  const deployment = env.AZURE_OPENAI_IMAGE_DEPLOYMENT ?? "";
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(deployment)) {
    throw new ConfigurationError("Set AZURE_OPENAI_IMAGE_DEPLOYMENT to a valid deployment alias.");
  }
  if (env.AZURE_OPENAI_IMAGE_MODEL && env.AZURE_OPENAI_IMAGE_MODEL !== "gpt-image-2.5-sunburst") {
    throw new ConfigurationError("Only the configured Sunburst profile is supported. Deployment aliases do not prove model identity.");
  }
  if (!env.IMAGE_GEN_OUTPUT_DIR || !isAbsolute(env.IMAGE_GEN_OUTPUT_DIR)) {
    throw new ConfigurationError("Set IMAGE_GEN_OUTPUT_DIR to an explicit absolute private directory.");
  }
  let inputRoots: string[];
  try {
    inputRoots = z.array(z.string().refine(isAbsolute)).parse(JSON.parse(env.IMAGE_GEN_INPUT_DIRS ?? "[]")).map((path) => resolve(path));
  } catch {
    throw new ConfigurationError("IMAGE_GEN_INPUT_DIRS must be a JSON array of absolute approved directories.");
  }
  const mode = env.IMAGE_GEN_AUTH ?? "azure-cli";
  if (mode !== "azure-cli" && mode !== "api-key") throw new ConfigurationError("IMAGE_GEN_AUTH must be azure-cli or api-key.");
  if (mode === "azure-cli" && env.AZURE_OPENAI_API_KEY) {
    throw new ConfigurationError("API key present with azure-cli mode. Select IMAGE_GEN_AUTH=api-key explicitly or remove the conflicting key.");
  }
  if (mode === "api-key" && env.AZURE_TENANT_ID) {
    throw new ConfigurationError("AZURE_TENANT_ID is a CLI-auth option; remove it for explicit API-key mode.");
  }
  const key = env.AZURE_OPENAI_API_KEY;
  if (mode === "api-key" && (!key || /\s/.test(key))) {
    throw new ConfigurationError("API-key mode requires a nonempty AZURE_OPENAI_API_KEY without whitespace.");
  }
  if (env.AZURE_TENANT_ID && !z.string().uuid().safeParse(env.AZURE_TENANT_ID).success) {
    throw new ConfigurationError("AZURE_TENANT_ID must be a tenant UUID.");
  }
  if (env.IMAGE_GEN_PREVIEW !== undefined && !["true", "false"].includes(env.IMAGE_GEN_PREVIEW)) {
    throw new ConfigurationError("IMAGE_GEN_PREVIEW must be true or false.");
  }
  const credential = mode === "azure-cli" ? cliFactory(env.AZURE_TENANT_ID) : null;
  return {
    endpoint: endpoint.href, deployment, model: "gpt-image-2.5-sunburst",
    outputRoot: resolve(env.IMAGE_GEN_OUTPUT_DIR),
    inputRoots,
    authMode: mode, preview: env.IMAGE_GEN_PREVIEW !== "false",
    async headers(signal) {
      if (mode === "api-key") return { "api-key": key! };
      try {
        const token = await credential!.getToken("https://cognitiveservices.azure.com/.default", signal ? { abortSignal: signal } : {});
        if (!token?.token) throw new Error("No token returned.");
        return { authorization: `Bearer ${token.token}` };
      } catch (cause) {
        throw credentialFailure(cause, signal);
      }
    },
  };
}
