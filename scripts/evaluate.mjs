import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { smokeSource } from "./lib/smoke-source.mjs";

const { values } = parseArgs({ options: {
  case: { type: "string" }, ledger: { type: "string" }, record: { type: "string" },
  "source-artifact": { type: "string" },
} });
try {
  const suite = JSON.parse(await readFile(new URL("../evaluation/briefs.json", import.meta.url), "utf8"));
  if (!Object.hasOwn(suite.cases, values.case) || !values.ledger || !values.record) throw new Error("Invalid evaluation case/paths.");
  const source = smokeSource(values["source-artifact"]);
  if ((values.case === "edit") !== (source.tool === "edit_image")) throw new Error("Only edit requires an explicit source artifact.");
  const args = [
    fileURLToPath(new URL("./smoke-mcp.mjs", import.meta.url)),
    "--ledger", values.ledger, "--record", values.record, "--prompt", suite.cases[values.case],
  ];
  if (source.tool === "edit_image") args.push("--source-artifact", source.args.source_artifact_id);
  execFileSync(process.execPath, args, { env: process.env, stdio: "inherit" });
} catch {
  process.stderr.write("Evaluation case failed or was refused. Check the selected case, explicit source, runtime configuration and private attempt/result/ledger. No regeneration or retry was attempted.\n");
  process.exitCode = 1;
}
