import { z } from "zod";
import { ConfigurationError, credentialFailure, loadConfiguration, type Configuration, type CredentialFailureReason } from "./config.js";
import { errorResult } from "./errors.js";
import type { ToolHandler } from "./server.js";
import { checkCopilotIdentity, type CopilotClientFactory } from "./copilot-provider.js";

export const sizes = ["1536x864"] as const;
export const qualities = ["high"] as const;
export const copilotSizes = ["auto", "1024x1024", "1536x1024", "1024x1536"] as const;
export const copilotQualities = ["auto", "low", "medium", "high"] as const;
export const apiVersion = "2025-04-01-preview";
const argsSchema = z.object({ check_credentials: z.boolean().default(false) }).strict();
type Check = { status: "passed" | "failed" | "unverified"; detail: string; reason?: CredentialFailureReason };

export function capabilitiesTool(load: () => Configuration = loadConfiguration, clientFactory?: CopilotClientFactory): ToolHandler {
  return {
    definition: {
      name: "get_capabilities",
      description: "Nonbillable configuration and capability diagnostics. Optional credential acquisition does NOT verify inference permission or deployment identity.",
      inputSchema: {
        type: "object",
        properties: { check_credentials: { type: "boolean", default: false } },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async invoke(args, signal) {
      const parsed = argsSchema.safeParse(args);
      if (!parsed.success) return errorResult(parsed.error);
      const checks: Record<string, Check> = {
        configuration: { status: "unverified", detail: "Configuration has not been checked." },
        credentialAcquisition: { status: "unverified", detail: "Not requested; use check_credentials explicitly." },
        managementMetadata: { status: "unverified", detail: "No management-plane query is made. Lack of management access does not imply inference failure." },
        inference: { status: "unverified", detail: "No billable image request is made by diagnostics." },
      };
      let config: Configuration | undefined;
      try {
        config = load();
        checks.configuration = { status: "passed", detail: "Configuration syntax is valid; network reachability, paths and deployment existence remain unverified." };
      } catch (error) {
        checks.configuration = {
          status: "failed",
          detail: error instanceof ConfigurationError ? error.message : "Configuration could not be loaded. Check the documented environment settings.",
        };
      }
      if (config && parsed.data.check_credentials) {
        try {
          signal.throwIfAborted();
          if (config.backend === "copilot") {
            await checkCopilotIdentity(config, signal, clientFactory);
          } else {
            await config.headers(signal);
          }
          checks.credentialAcquisition = {
            status: "passed",
            detail: config.backend === "copilot"
              ? "Copilot is signed in to the expected account. No account switch, token extraction or image request was made; inference remains unverified."
              : config.authMode === "api-key"
              ? "A key is configured. Its validity and inference permissions remain unverified."
              : "A CLI token was acquired. Inference permissions remain unverified.",
          };
        } catch (cause) {
          if (config.backend === "copilot") {
            checks.credentialAcquisition = { status: "failed", detail: "Copilot runtime or expected-account check failed. Verify IMAGE_GEN_COPILOT_LOGIN and the runtime; no alternate account was tried." };
          } else {
            const failure = credentialFailure(cause, signal);
            checks.credentialAcquisition = { status: "failed", detail: failure.message, reason: failure.reason };
          }
        }
      }
      const data = {
        checks,
        backend: config?.backend === "copilot" ? "copilot" : "azure",
        model: {
          configured: config?.backend === "copilot" ? null : config?.model ?? null,
          deployed: null,
          observed: null,
          evidence: config?.backend === "copilot" ? "unverified" : "configured-profile-only",
        },
        deployment: config?.backend === "copilot" ? null : config?.deployment ?? null,
        authMode: config?.authMode ?? null,
        ...(config?.backend === "copilot" ? { authIdentity: { expectedLogin: config.expectedLogin } } : {}),
        profile: {
          sizes: config?.backend === "copilot" ? copilotSizes : sizes,
          qualities: config?.backend === "copilot" ? copilotQualities : qualities,
          format: "png", imagesPerRequest: 1, concurrentSubmissions: 1,
          apiVersion: config?.backend === "copilot" ? null : apiVersion, previewEnabled: config?.preview ?? null,
          capabilityEvidence: config?.backend === "copilot"
            ? "Experimental SDK image-tool options; native account authorization and actual output options are not established by configuration."
            : "Documented model options, intentionally restricted to this v1 subset; not a deployment discovery result.",
          liveEvidence: config?.backend === "copilot" ? null :
            { size: "1536x864", quality: "high", auth: "api-key", reference: "docs/evidence/azure-contract.md" },
        },
        smokeTest: config?.backend === "copilot"
          ? "Generation/editing consume Copilot credits. Use a fresh operation UUID only after explicit approval; diagnostics never generate."
          : "For an explicitly opted-in billable check, use scripts/probe-azure.mjs with the bounded live-testing procedure. Diagnostics never invoke it.",
      };
      return {
        isError: Object.values(checks).some((check) => check.status === "failed"),
        content: [{ type: "text", text: JSON.stringify(data) }],
        structuredContent: data,
      };
    },
  };
}
