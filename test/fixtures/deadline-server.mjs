import { appendFileSync } from "node:fs";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "../../dist/server.js";

const record = (event) => appendFileSync(process.env.DEADLINE_RECORD, JSON.stringify({ event, at: Date.now() }) + "\n");
const server = createServer([{
  definition: {
    name: "wait_probe", description: "Nonbillable local deadline test: waits 2500ms.",
    inputSchema: { type: "object", additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async invoke(_args, signal) {
    record("started");
    signal.addEventListener("abort", () => record("cancelled"), { once: true });
    await new Promise((resolve) => setTimeout(resolve, 2500));
    record("completed");
    return { content: [{ type: "text", text: "Local deadline probe completed after 2500ms. No Azure request." }] };
  },
}]);
await server.connect(new StdioServerTransport());
