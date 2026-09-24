#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

const server = createServer();
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void server.close().catch(() => {
      process.stderr.write("MCP shutdown failed.\n");
      process.exitCode = 1;
    });
  });
}
try {
  await server.connect(new StdioServerTransport());
} catch {
  process.stderr.write("MCP startup failed. Check Node compatibility and stdio transport.\n");
  process.exitCode = 1;
}
