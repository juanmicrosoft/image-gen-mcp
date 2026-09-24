import { appendFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ArtifactStore } from "../../dist/artifacts.js";
import { OperationStore } from "../../dist/operations.js";

const [root, id, phase, source] = process.argv.slice(2);
const artifacts = await ArtifactStore.create(root);
const operations = await OperationStore.create(artifacts);
const bytes = await readFile(source);
async function pause(at) {
  if (phase !== at) return;
  process.send({ phase: at });
  await new Promise(() => { setInterval(() => {}, 1000); });
}
await operations.run(id, { prompt: "fixture" }, async (artifactId) => {
  appendFileSync(join(root, "submissions.txt"), "1\n", { flush: true });
  await pause("post-submit");
  const result = await artifacts.save(bytes, {
    deployment: "fixture", model: "gpt-image-2.5-sunburst", modelEvidence: "configured",
    size: "1536x864", quality: "high",
  }, artifactId);
  await pause("post-save");
  return result;
});
await pause("post-result");
