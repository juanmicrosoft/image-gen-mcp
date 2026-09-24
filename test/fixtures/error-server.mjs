import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "../../dist/server.js";
import { errorCodes, errorResult, ImageError, providerError } from "../../dist/errors.js";
const privateMessage = "PRIVATE_KEY_PROMPT_DO_NOT_ECHO";
const coded = (code) => Object.assign(new Error(privateMessage), { code });
const cases = {
  invalid_input: providerError(400, "invalid_value"),
  authentication: providerError(401, "invalid_key"),
  permission: providerError(401, "PermissionDenied"),
  deployment: providerError(404, ""),
  policy: providerError(400, "content_filter"),
  quota: providerError(429, "insufficient_quota"),
  throttled: providerError(429, "RateLimitReached"),
  network: new TypeError(privateMessage, { cause: coded("ECONNRESET") }),
  timeout: Object.assign(new Error(privateMessage), { name: "AbortError" }),
  provider_output: new ImageError("provider_output", "Malformed provider output."),
  persistence: coded("ENOSPC"),
  service: providerError(500, ""),
  busy: coded("busy"), conflict: coded("conflict"),
  outcome_unknown: coded("outcome_unknown"), previous_failure: coded("previous_failure"),
  internal: new Error(privateMessage),
};
const server = createServer([{
  definition: { name: "fail_case", description: "Offline test fixture only",
    inputSchema: { type: "object", properties: { code: { type: "string", enum: errorCodes } }, required: ["code"], additionalProperties: false } },
  async invoke(args) { return errorResult(cases[args.code]); },
}]);
await server.connect(new StdioServerTransport());
