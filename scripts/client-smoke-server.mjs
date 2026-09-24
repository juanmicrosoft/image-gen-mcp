import { execFileSync } from "node:child_process";
import { appendFile, readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "../dist/server.js";
import { capabilitiesTool } from "../dist/capabilities.js";
import { imageTools } from "../dist/image-tools.js";
import { loadConfiguration } from "../dist/config.js";
import { liveBudget } from "./lib/live-budget.mjs";

// Developer-only harness: management key retrieval is never part of the runtime.
try {
  const { IMAGE_GEN_SMOKE_STATE: statePath, IMAGE_GEN_BUDGET_LEDGER: ledger } = process.env;
  if (!statePath || !isAbsolute(statePath) || !ledger || !isAbsolute(ledger)) throw new Error("Absolute smoke paths required.");
  const budget = liveBudget(process.env, ledger);
  const state = JSON.parse(await readFile(statePath, "utf8"));
  const key = execFileSync("az", [
    "cognitiveservices", "account", "keys", "list", "--resource-group", state.group,
    "--name", state.name, "--subscription", state.subscription, "--query", "key1",
    "--only-show-errors", "-o", "tsv",
  ], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const config = loadConfiguration({
    AZURE_OPENAI_ENDPOINT: state.endpoint, AZURE_OPENAI_IMAGE_DEPLOYMENT: state.deployment,
    IMAGE_GEN_OUTPUT_DIR: process.env.IMAGE_GEN_OUTPUT_DIR, IMAGE_GEN_AUTH: "api-key",
    AZURE_OPENAI_API_KEY: key, IMAGE_GEN_PREVIEW: process.env.IMAGE_GEN_PREVIEW ?? "true",
  });
  const boundedFetch = (url, options) => budget.run(async () => {
    const started = Date.now();
    const response = await fetch(url, options);
    await appendFile(`${ledger}.requests.jsonl`, JSON.stringify({
      recordedAt: new Date().toISOString(), status: response.status, elapsedMs: Date.now() - started,
    }) + "\n", { mode: 0o600 });
    return response;
  });
  const server = createServer([capabilitiesTool(() => config), ...imageTools(() => config, boundedFetch)]);
  await server.connect(new StdioServerTransport());
} catch {
  process.stderr.write("Bounded developer client smoke server could not start. Inspect private configuration and explicit test bounds.\n");
  process.exitCode = 1;
}
