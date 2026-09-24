import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

test("built executable initializes, lists tools, rejects unknown calls and shuts down", async () => {
  const transport = new StdioClientTransport({
    command: process.execPath, args: ["dist/cli.js"], stderr: "pipe",
  });
  let diagnostics = "";
  transport.stderr?.on("data", (chunk) => { diagnostics += chunk; });
  const client = new Client({ name: "offline-contract", version: "1.0.0" });
  try {
    await client.connect(transport);
    assert.equal(client.getServerVersion().name, "image-gen-mcp");
    assert.ok(Array.isArray((await client.listTools()).tools));
    await client.ping();
    await assert.rejects(client.callTool({ name: "does_not_exist", arguments: {} }), /Unknown tool/);
  } finally {
    await client.close();
  }
  assert.equal(diagnostics, "");
});
