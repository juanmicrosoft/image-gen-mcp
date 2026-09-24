import sharp from "sharp";
import { dirname } from "node:path";
import { z } from "zod";
import { ArtifactStore, readLocalImage, sha256, type Artifact } from "./artifacts.js";
import { qualities, sizes } from "./capabilities.js";
import { ConfigurationError, loadConfiguration } from "./config.js";
import { errorResult, ImageError, normalizeError } from "./errors.js";
import { OperationError, OperationStore } from "./operations.js";
import { generate } from "./provider.js";
import type { ToolHandler } from "./server.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

const generateSchema = z.object({
  operation_id: z.string().uuid(),
  prompt: z.string().min(1).max(32_000).refine((value) => value.trim().length > 0),
  size: z.enum(sizes).default("1536x864"),
  quality: z.enum(qualities).default("high"),
}).strict();
const statusSchema = z.object({ operation_id: z.string().uuid() }).strict();

export async function artifactResult(artifact: Artifact, operationId: string, preview: boolean): Promise<CallToolResult> {
  const content: CallToolResult["content"] = [];
  let previewStatus = preview ? "included" : "disabled";
  if (preview) {
    const bytes = await readLocalImage(artifact.path, [dirname(artifact.path)]);
    if (sha256(bytes) !== artifact.sha256) throw new ImageError("persistence", "Saved image changed before preview creation. Inspect the retained operation.");
    const thumbnail = await sharp(bytes).resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 75 }).toBuffer();
    if (thumbnail.length <= 256 * 1024) {
      content.push({ type: "image", mimeType: "image/jpeg", data: thumbnail.toString("base64") });
    } else { previewStatus = "omitted_size_limit"; }
  }
  const data = { operationId, state: "succeeded", artifact, usage: artifact.metadata.usage ?? null, preview: previewStatus };
  content.unshift({ type: "text", text: JSON.stringify(data) });
  return { content, structuredContent: data };
}

export function imageTools(load = loadConfiguration, fetcher: typeof fetch = fetch): ToolHandler[] {
  async function initialize() {
    let config;
    try { config = load(); } catch (error) {
      throw new ImageError("invalid_input", error instanceof ConfigurationError ? error.message : "Invalid image server configuration.", true);
    }
    try {
      const artifacts = await ArtifactStore.create(config.outputRoot);
      return { config, artifacts, operations: await OperationStore.create(artifacts) };
    } catch {
      throw new ImageError("persistence", "Cannot initialize private artifact storage. Check the output directory and filesystem permissions.", true);
    }
  }
  let runtime: ReturnType<typeof initialize> | undefined;
  const getRuntime = () => runtime ??= initialize();
  function failure(error: unknown, args: Record<string, unknown>): CallToolResult {
    const result = errorResult(error);
    const data = {
      ...result.structuredContent,
      operationId: z.string().uuid().safeParse(args.operation_id).success ? args.operation_id : null,
      failureCategory: normalizeError(error instanceof OperationError && error.cause ? error.cause : error).code,
    };
    return { ...result, content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data };
  }
  return [
    {
      definition: {
        name: "generate_image",
        description: "Generate one billable Azure PNG at native 1536x864/high. Supply and retain a fresh UUID operation_id; replaying identical arguments recovers the same artifact without another submission. No retries, resizing or prompt rewrites.",
        inputSchema: {
          type: "object",
          properties: {
            operation_id: { type: "string", format: "uuid" },
            prompt: { type: "string", minLength: 1, maxLength: 32_000 },
            size: { type: "string", enum: [...sizes], default: "1536x864" },
            quality: { type: "string", enum: [...qualities], default: "high" },
          },
          required: ["operation_id", "prompt"], additionalProperties: false,
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
      },
      async invoke(args, signal) {
        try {
          const input = generateSchema.parse(args);
          const { config, artifacts, operations } = await getRuntime();
          signal.throwIfAborted();
          const { operation_id, ...request } = input;
          const artifact = await operations.run(operation_id, {
            ...request, tool: "generate_image", endpoint: config.endpoint, deployment: config.deployment, model: config.model,
          }, async (artifactId) => {
            const result = await generate(config, request, signal, fetcher);
            return artifacts.save(result.bytes, {
              deployment: config.deployment, model: config.model, modelEvidence: "configured",
              size: request.size, quality: request.quality, usage: result.usage,
              ...(result.requestId ? { requestId: result.requestId } : {}),
            }, artifactId);
          });
          return await artifactResult(artifact, operation_id, config.preview);
        } catch (error) { return failure(error, args); }
      },
    },
    {
      definition: {
        name: "get_operation",
        description: "Look up a retained operation UUID and recover a committed artifact after interruption. Never submits or resubmits an image request. Unknown completion may still incur charges.",
        inputSchema: { type: "object", properties: { operation_id: { type: "string", format: "uuid" } }, required: ["operation_id"], additionalProperties: false },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      async invoke(args) {
        try {
          const input = statusSchema.parse(args);
          const { operations } = await getRuntime();
          const status = await operations.status(input.operation_id);
          const data = {
            operationId: input.operation_id, operation: status,
            state: status?.state ?? "not_found", usage: status?.artifact?.metadata.usage ?? null,
            automaticResubmission: false,
            warning: status?.state === "outcome_unknown" ? "Azure may still be processing or billing this request. Do not resubmit automatically." : null,
          };
          return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data };
        } catch (error) { return failure(error, args); }
      },
    },
  ];
}
