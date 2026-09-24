import { AzureCliCredential } from "@azure/identity";
import { isAbsolute, resolve } from "node:path";
import { z } from "zod";

export class ConfigurationError extends Error {}
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
  if (env.IMAGE_GEN_PREVIEW && !["true", "false"].includes(env.IMAGE_GEN_PREVIEW)) {
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
        throw new ConfigurationError("Azure CLI authentication failed. Run az login for the intended tenant; no alternate credential was tried.", { cause });
      }
    },
  };
}
