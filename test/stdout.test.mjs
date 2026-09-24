import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { once } from "node:events";

test("actual executable emits only JSON-RPC, exposes all four tools and needs no Azure credentials", { timeout: 10_000 }, async (t) => {
  const child = spawn(process.execPath, ["--import", "./test/fixtures/offline-fetch.mjs", "dist/cli.js"], {
    env: {}, stdio: ["pipe", "pipe", "pipe"],
  });
  t.after(() => { if (child.exitCode === null) child.kill("SIGTERM"); });
  let buffer = "", stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const exit = once(child, "exit");
  const response = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.stdout.on("data", (chunk) => {
      buffer += chunk;
      let index;
      while ((index = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 1);
        try {
          const message = JSON.parse(line);
          assert.equal(message.jsonrpc, "2.0");
          if (message.id === 1) {
            assert.ok(message.result.serverInfo);
            child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
            child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }) + "\n");
          }
          if (message.id === 2) resolve(message);
        } catch (error) { reject(error); }
      }
    });
  });
  child.stdin.write(JSON.stringify({
    jsonrpc: "2.0", id: 1, method: "initialize",
    params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "stdout-check", version: "1" } },
  }) + "\n");
  const result = await response;
  assert.deepEqual(result.result.tools.map((tool) => tool.name).sort(),
    ["edit_image", "generate_image", "get_capabilities", "get_operation"]);
  child.stdin.end();
  const [code] = await exit;
  assert.equal(code, 0);
  assert.equal(buffer, "");
  assert.equal(stderr, "");
});
