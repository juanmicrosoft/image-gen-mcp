import { mkdir, open, writeFile } from "node:fs/promises";
import { dirname, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { randomUUID } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { syncDirectories } from "../dist/artifacts.js";
import { liveBudget } from "./lib/live-budget.mjs";

const { values } = parseArgs({ options: {
  ledger: { type: "string" }, record: { type: "string" }, prompt: { type: "string" },
} });
let client;
try {
  if (!values.ledger || !isAbsolute(values.ledger) || !values.record || !isAbsolute(values.record) || !values.prompt) {
    throw new Error("Provide absolute --ledger/--record paths and a --prompt.");
  }
  const budget = liveBudget(process.env, values.ledger);
  const operationId = randomUUID();
  await mkdir(dirname(values.record), { recursive: true, mode: 0o700 });
  const attempt = await open(`${values.record}.attempt.json`, "wx", 0o600);
  try {
    await attempt.writeFile(JSON.stringify({ operationId, startedAt: new Date().toISOString(), tool: "generate_image" }));
    await attempt.sync();
  } finally { await attempt.close(); }
  await syncDirectories(dirname(values.record));
  const transport = new StdioClientTransport({
    command: process.execPath, args: [fileURLToPath(new URL("../dist/cli.js", import.meta.url))],
    env: process.env, stderr: "inherit",
  });
  client = new Client({ name: "bounded-live-smoke", version: "1" });
  await client.connect(transport);
  const started = Date.now();
  const result = await budget.run(() => client.callTool({
    name: "generate_image", arguments: { operation_id: operationId, prompt: values.prompt },
  }, undefined, { timeout: 240_000 }));
  const evidence = {
    recordedAt: new Date().toISOString(), elapsedMs: Date.now() - started,
    isError: result.isError ?? false, result: result.structuredContent,
    imageContentBlocks: result.content.filter((block) => block.type === "image").length,
  };
  await writeFile(values.record, JSON.stringify(evidence, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  process.stdout.write(JSON.stringify(evidence, null, 2) + "\n");
  if (result.isError) process.exitCode = 1;
} catch {
  process.stderr.write("MCP smoke check failed. Inspect the private attempt, operation, result and budget records; no automatic retry.\n");
  process.exitCode = 1;
} finally {
  if (client) await client.close();
}
