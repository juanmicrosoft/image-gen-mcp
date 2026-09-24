import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { errorCodes } from "../dist/errors.js";

test("all error categories traverse real stdio MCP as errors without private data", async () => {
  const client = new Client({ name: "error-contract", version: "1" });
  const transport = new StdioClientTransport({
    command: process.execPath, args: ["test/fixtures/error-server.mjs"], stderr: "pipe",
  });
  try {
    await client.connect(transport);
    for (const code of errorCodes) {
      const result = await client.callTool({ name: "fail_case", arguments: { code } });
      assert.equal(result.isError, true, code);
      assert.equal(result.structuredContent.error.code, code);
      assert.equal(result.structuredContent.error.automaticRetry, false);
      assert.equal(result.structuredContent.error.billing, "unknown");
      assert.ok(!JSON.stringify(result).includes("PRIVATE_KEY_PROMPT_DO_NOT_ECHO"));
      assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
    }
  } finally { await client.close(); }
});
