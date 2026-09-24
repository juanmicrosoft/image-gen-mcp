import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  type CallToolResult,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";

export interface ToolHandler {
  definition: Tool;
  invoke(args: Record<string, unknown>, signal: AbortSignal): Promise<CallToolResult>;
}

export function createServer(tools: readonly ToolHandler[] = []): Server {
  const server = new Server(
    { name: "image-gen-mcp", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );
  const byName = new Map(tools.map((tool) => [tool.definition.name, tool]));
  if (byName.size !== tools.length) throw new Error("Duplicate tool registration.");
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((tool) => tool.definition),
  }));
  server.setRequestHandler(CallToolRequestSchema, async (request, context) => {
    const tool = byName.get(request.params.name);
    if (!tool) throw new McpError(ErrorCode.InvalidParams, "Unknown tool.");
    return tool.invoke(request.params.arguments ?? {}, context.signal);
  });
  return server;
}
