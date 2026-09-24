import { appendFile, readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "../dist/server.js";
import { liveBudget } from "./lib/live-budget.mjs";

let child;
try {
  const { IMAGE_GEN_PACKED_CONFIG: path, IMAGE_GEN_BUDGET_LEDGER: ledger } = process.env;
  if (!path || !ledger || !isAbsolute(path) || !isAbsolute(ledger)) throw new Error("Absolute private configuration/ledger paths required.");
  const budget = liveBudget(process.env, ledger);
  const configured = JSON.parse(await readFile(path, "utf8")).mcpServers["image-gen"];
  child = new Client({ name: "bounded-packed-proxy", version: "1" });
  const transport = new StdioClientTransport({
    command: configured.command, args: configured.args,
    env: { ...configured.env, HOME: process.env.IMAGE_GEN_TEST_HOME, PATH: process.env.PATH,
      IMAGE_GEN_AZ_ATTEMPT_LOG: process.env.IMAGE_GEN_AZ_ATTEMPT_LOG },
    stderr: "inherit",
  });
  await child.connect(transport);
  await appendFile(`${ledger}.processes.jsonl`, JSON.stringify({ proxy: process.pid, child: transport.pid }) + "\n", { mode: 0o600 });
  let lastSubmission = 0;
  const tools = (await child.listTools()).tools.map((definition) => ({
    definition,
    async invoke(args, signal) {
      const call = () => child.callTool({ name: definition.name, arguments: args }, undefined, { signal, timeout: 240_000 });
      if (!["generate_image", "edit_image"].includes(definition.name)) return call();
      return budget.run(async () => {
        await delay(Math.max(0, 65_000 - (Date.now() - lastSubmission)), undefined, { signal });
        signal.throwIfAborted();
        lastSubmission = Date.now();
        const result = await call();
        await appendFile(`${ledger}.results.jsonl`, JSON.stringify({
          recordedAt: new Date().toISOString(), tool: definition.name, elapsedMs: Date.now() - lastSubmission,
          isError: result.isError ?? false, result: result.structuredContent,
        }) + "\n", { mode: 0o600 });
        return result;
      });
    },
  }));
  const server = createServer(tools);
  server.onclose = () => { void child.close().catch(() => { process.stderr.write("Packed child shutdown failed.\n"); process.exitCode = 1; }); };
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => {
    void server.close().catch(() => { process.stderr.write("Packed proxy shutdown failed.\n"); process.exitCode = 1; });
  });
  await server.connect(new StdioServerTransport());
} catch {
  if (child) await child.close();
  process.stderr.write("Bounded packed-package smoke server failed; inspect private configuration and ledger. No automatic retry.\n");
  process.exitCode = 1;
}
