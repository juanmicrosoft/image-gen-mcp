import { z } from "zod";

export function smokeSource(source) {
  if (source === undefined) return { tool: "generate_image", args: {} };
  return { tool: "edit_image", args: { source_artifact_id: z.string().uuid().parse(source) } };
}
