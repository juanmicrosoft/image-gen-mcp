import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { imageTools } from "../dist/image-tools.js";

test("edit discovery is a plain object while exclusive source validation stays server-side", async () => {
  let initialized = false;
  let fetched = false;
  const edit = imageTools(() => {
    initialized = true;
    throw new Error("invalid arguments must be rejected before configuration");
  }, async () => { fetched = true; throw new Error("must not fetch"); })
    .find((tool) => tool.definition.name === "edit_image");
  assert.equal(edit.definition.inputSchema.type, "object");
  for (const keyword of ["oneOf", "anyOf", "allOf", "not", "if", "then", "else"]) {
    assert.equal(Object.hasOwn(edit.definition.inputSchema, keyword), false);
  }
  assert.match(edit.definition.description, /exactly one/);
  for (const source of [{}, { source_artifact_id: randomUUID(), source_path: "/test.png" }]) {
    const result = await edit.invoke({ operation_id: randomUUID(), prompt: "test", ...source }, new AbortController().signal);
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent.error.code, "invalid_input");
  }
  assert.equal(initialized, false);
  assert.equal(fetched, false);
});
