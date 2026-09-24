import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { parseArgs } from "node:util";
import { liveBudget } from "./lib/live-budget.mjs";

const { values } = parseArgs({ options: {
  state: { type: "string" }, output: { type: "string" }, source: { type: "string" },
  auth: { type: "string", default: "api-key" },
  size: { type: "string", default: "1536x864" },
  quality: { type: "string", default: "high" },
  "expect-failure": { type: "boolean", default: false },
} });
try {
  if (!values.state || !values.output || !isAbsolute(values.state) || !isAbsolute(values.output)) {
    throw new Error("Provide absolute --state and --output paths.");
  }
  if (!["api-key", "azure-cli"].includes(values.auth)) throw new Error("Invalid auth mode.");
  const budget = liveBudget(process.env, join(dirname(values.state), "probe-budget.json"));
  const state = JSON.parse(await readFile(values.state, "utf8"));
  const endpoint = new URL(state.endpoint);
  if (endpoint.protocol !== "https:" || !/^[a-z0-9-]+\.openai\.azure\.com$/.test(endpoint.hostname) ||
      endpoint.pathname !== "/" || endpoint.search || endpoint.hash || endpoint.username || endpoint.password || endpoint.port) {
    throw new Error("Expected an Azure OpenAI resource root.");
  }
  const getAz = (...args) => execFileSync("az", [...args, "--only-show-errors", "-o", "tsv"], { encoding: "utf8" }).trim();
  const headers = values.auth === "api-key"
    ? { "api-key": getAz("cognitiveservices", "account", "keys", "list", "--resource-group", state.group, "--name", state.name, "--subscription", state.subscription, "--query", "key1") }
    : { authorization: `Bearer ${getAz("account", "get-access-token", "--resource", "https://cognitiveservices.azure.com/", "--subscription", state.subscription, "--query", "accessToken")}` };
  const operation = values.source ? "edits" : "generations";
  const options = {
    prompt: values.source
      ? "Keep the composition and mountains unchanged. Change the sky to a warm coral sunrise. Leave the left third dark and uncluttered for editable slide text. No lettering."
      : "Editorial illustration for a technology presentation: a luminous cyan observatory above layered deep teal mountains, on the right two thirds. Dark navy empty negative space in the left third for editable slide text. Refined geometric shapes, subtle atmospheric light, no lettering or logos.",
    n: 1, size: values.size, quality: values.quality, output_format: "png",
  };
  let body;
  if (values.source) {
    const source = await readFile(values.source);
    if (source.length > 20 * 1024 * 1024) throw new Error("Reference image too large.");
    body = new FormData();
    for (const [key, value] of Object.entries(options)) body.set(key, String(value));
    body.set("image", new Blob([source], { type: "image/png" }), "reference.png");
  } else {
    headers["content-type"] = "application/json";
    body = JSON.stringify(options);
  }
  await mkdir(dirname(values.output), { recursive: true, mode: 0o700 });
  await writeFile(`${values.output}.attempt.json`, JSON.stringify({
    startedAt: new Date().toISOString(), operation, size: values.size, quality: values.quality,
    auth: values.auth, outcome: "unknown-until-result-file",
  }), { flag: "wx", mode: 0o600 });
  const started = Date.now();
  const response = await budget.run(() => fetch(
    new URL(`openai/deployments/${encodeURIComponent(state.deployment)}/images/${operation}?api-version=2025-04-01-preview`, endpoint),
    { method: "POST", headers, body, signal: AbortSignal.timeout(240_000), redirect: "error" },
  ).then(async (response) => {
    const chunks = [];
    let length = 0;
    for await (const chunk of response.body) {
      length += chunk.length;
      if (length > 32 * 1024 * 1024) throw new Error("Response exceeded probe limit; outcome unknown.");
      chunks.push(chunk);
    }
    return { status: response.status, ok: response.ok, requestId: response.headers.get("x-ms-request-id"),
      json: JSON.parse(Buffer.concat(chunks).toString("utf8")) };
  }));
  const evidence = {
    apiVersion: "2025-04-01-preview", operation, auth: values.auth, status: response.status,
    elapsedMs: Date.now() - started, size: values.size, quality: values.quality,
    responseKeys: Object.keys(response.json), requestId: response.requestId,
    errorCode: typeof response.json.error?.code === "string" ? response.json.error.code : null,
    usage: response.json.usage ? Object.fromEntries(["input_tokens", "output_tokens", "total_tokens"]
      .filter((key) => typeof response.json.usage[key] === "number").map((key) => [key, response.json.usage[key]])) : null,
  };
  if (response.ok) {
    if (!Array.isArray(response.json.data) || response.json.data.length !== 1 ||
        typeof response.json.data[0]?.b64_json !== "string") throw new Error("Unexpected image response shape.");
    const bytes = Buffer.from(response.json.data[0].b64_json, "base64");
    if (bytes.length < 24 || !bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error("Expected PNG bytes.");
    evidence.width = bytes.readUInt32BE(16); evidence.height = bytes.readUInt32BE(20);
    evidence.sha256 = createHash("sha256").update(bytes).digest("hex");
    await writeFile(values.output, bytes, { flag: "wx", mode: 0o600 });
  }
  await writeFile(`${values.output}.result.json`, JSON.stringify(evidence, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  process.stdout.write(JSON.stringify(evidence, null, 2) + "\n");
  if (response.ok === values["expect-failure"]) throw new Error("Probe outcome did not match the requested success/failure expectation.");
} catch (error) {
  process.stderr.write(`Probe failed: ${error.message}. No automatic retry; inspect attempt/result/budget records.\n`);
  process.exitCode = 1;
}
