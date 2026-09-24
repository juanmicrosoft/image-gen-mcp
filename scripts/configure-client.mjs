import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { ConfigurationError, loadConfiguration } from "../dist/config.js";

const { values } = parseArgs({ options: {
  output: { type: "string" }, entrypoint: { type: "string" },
  "allow-plaintext-key": { type: "boolean", default: false },
} });
try {
  if (!values.output || !isAbsolute(values.output)) throw new Error("Provide an absolute private --output path.");
  const entrypoint = values.entrypoint ?? fileURLToPath(new URL("../dist/cli.js", import.meta.url));
  if (!isAbsolute(entrypoint)) throw new Error("Entrypoint must be an absolute trusted compiled CLI path.");
  const config = loadConfiguration();
  if (config.authMode === "api-key" && !values["allow-plaintext-key"]) {
    throw new Error("API-key client configuration stores a plaintext key. Explicitly acknowledge with --allow-plaintext-key, or use an authorized CLI identity.");
  }
  const env = {
    AZURE_OPENAI_ENDPOINT: config.endpoint, AZURE_OPENAI_IMAGE_DEPLOYMENT: config.deployment,
    AZURE_OPENAI_IMAGE_MODEL: config.model, IMAGE_GEN_OUTPUT_DIR: config.outputRoot,
    IMAGE_GEN_INPUT_DIRS: JSON.stringify(config.inputRoots), IMAGE_GEN_AUTH: config.authMode,
    IMAGE_GEN_PREVIEW: String(config.preview),
    ...(config.authMode === "api-key" ? { AZURE_OPENAI_API_KEY: process.env.AZURE_OPENAI_API_KEY } : {}),
    ...(config.authMode === "azure-cli" && process.env.AZURE_TENANT_ID ? { AZURE_TENANT_ID: process.env.AZURE_TENANT_ID } : {}),
  };
  const client = { mcpServers: { "image-gen": {
    type: "stdio", command: process.execPath, args: [entrypoint], env, tools: ["*"], timeout: 240_000,
  } } };
  await mkdir(dirname(values.output), { recursive: true, mode: 0o700 });
  await writeFile(values.output, JSON.stringify(client, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  process.stdout.write("Private Copilot CLI configuration created. It was not registered globally; use --additional-mcp-config with this file.\n");
} catch (error) {
  const message = error instanceof ConfigurationError ? error.message :
    error instanceof Error && !("code" in error) ? error.message : "Cannot write client configuration; check the private path and avoid overwriting an existing file.";
  process.stderr.write(`Client configuration failed: ${message}\n`);
  process.exitCode = 1;
}
