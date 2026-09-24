import { appendFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "../../dist/server.js";
import { imageTools } from "../../dist/image-tools.js";
import { loadConfiguration } from "../../dist/config.js";
import { sha256 } from "../../dist/artifacts.js";

const config = loadConfiguration();
const server = createServer(imageTools(() => config, async (url, options) => {
  const form = options.body instanceof FormData ? options.body : null;
  const request = form ? Object.fromEntries(form) : JSON.parse(options.body);
  if (form && options.headers["content-type"]) throw new Error("Manual multipart boundary/header.");
  const source = form ? Buffer.from(await form.get("image").arrayBuffer()) : null;
  await appendFile(join(config.outputRoot, "fixture-calls.jsonl"), JSON.stringify({
    url, sourceHash: source ? sha256(source) : null,
    fields: Object.keys(request).sort(), n: request.n,
  }) + "\n");
  const bytes = await sharp({ create: {
    width: 1536, height: 864, channels: 3,
    background: request.prompt.includes("coral") ? "#f96167" : "#065a82",
  } }).png().toBuffer();
  return Response.json({ data: [{ b64_json: bytes.toString("base64") }] });
}));
await server.connect(new StdioServerTransport());
