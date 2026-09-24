import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: {
  action: { type: "string" }, subscription: { type: "string" },
  group: { type: "string" }, name: { type: "string" },
  state: { type: "string" }, location: { type: "string", default: "eastus2" },
  confirm: { type: "string" },
  auth: { type: "string", default: "azure-cli" },
} });
function az(...args) {
  const output = execFileSync("az", [...args, "--only-show-errors", "-o", "json"], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  return output.trim() ? JSON.parse(output) : null;
}

function assertOwnedResources(resources, state) {
  if (resources.some((resource) =>
    resource.id.toLowerCase() !== state.resourceId.toLowerCase() ||
    resource.type?.toLowerCase() !== "microsoft.cognitiveservices/accounts" ||
    resource.tags?.project !== "image-gen-mcp" ||
    resource.tags?.ownerToken !== state.ownerToken)) {
    throw new Error("Unowned or unexpected resource in group; refusing deployment/deletion.");
  }
}

try {
  if (!values.state || !isAbsolute(values.state)) throw new Error("--state must be an absolute local JSON path.");
  let state;
  try {
    if ((await lstat(values.state)).isSymbolicLink()) throw new Error("State cannot be a symlink.");
    state = JSON.parse(await readFile(values.state, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const hadState = state !== undefined;
  if (!["provision", "cleanup"].includes(values.action)) throw new Error("--action must be provision or cleanup.");
  if (values.action === "cleanup") {
    if (!state || state.version !== 1 || values.confirm !== state.groupId) {
      throw new Error("Cleanup requires saved state and --confirm with the exact resource group ID.");
    }
    const group = az("group", "show", "--name", state.group, "--subscription", state.subscription);
    if (group.id.toLowerCase() !== state.groupId.toLowerCase() ||
        group.tags?.ownerToken !== state.ownerToken || group.tags?.project !== "image-gen-mcp") {
      throw new Error("Ownership tags differ; refusing cleanup.");
    }
    const resources = az("resource", "list", "--resource-group", state.group, "--subscription", state.subscription);
    assertOwnedResources(resources, state);
    az("group", "delete", "--name", state.group, "--subscription", state.subscription, "--yes");
    if (az("group", "exists", "--name", state.group, "--subscription", state.subscription)) {
      throw new Error("Deletion has not completed.");
    }
    process.stdout.write("Owned resource group deleted. Cognitive accounts may remain soft-deleted; no purge performed.\n");
  } else {
    if (!["azure-cli", "api-key"].includes(values.auth)) throw new Error("--auth must be azure-cli or api-key.");
    if (!values.subscription || !/^[a-zA-Z0-9-]{3,63}$/.test(values.name ?? "") ||
        !/^[a-zA-Z0-9-]{3,90}$/.test(values.group ?? "") || values.confirm !== "provision") {
      throw new Error("Provide --subscription, --group, --name and --confirm provision.");
    }
    const subscription = values.subscription;
    const groupId = `/subscriptions/${subscription}/resourceGroups/${values.group}`;
    if (state && (state.subscription !== subscription || state.group !== values.group ||
        state.name !== values.name || state.location !== values.location)) {
      throw new Error("Arguments differ from saved ownership state.");
    }
    if (az("account", "show", "--subscription", subscription).state !== "Enabled") throw new Error("Subscription is not enabled.");
    if (az("provider", "show", "--namespace", "Microsoft.CognitiveServices", "--subscription", subscription).registrationState !== "Registered") {
      throw new Error("Register Microsoft.CognitiveServices explicitly before provisioning.");
    }
    const models = az("cognitiveservices", "model", "list", "--location", values.location, "--subscription", subscription);
    const model = models.find((entry) => entry.kind === "AIServices" && entry.model?.name === "gpt-image-2.5-sunburst" && entry.model?.version === "2026-09-08");
    if (!model?.model.skus?.some((sku) => sku.name === "GlobalStandard")) throw new Error("Required model/version/SKU not listed.");
    const usage = az("cognitiveservices", "usage", "list", "--location", values.location, "--subscription", subscription);
    const quota = usage.find((entry) => entry.name?.value === "OpenAI.GlobalStandard.gpt-image-2.5-sunburst");
    const exists = az("group", "exists", "--name", values.group, "--subscription", subscription);
    if (exists) {
      const group = az("group", "show", "--name", values.group, "--subscription", subscription);
      if (!state || group.tags?.ownerToken !== state.ownerToken || group.tags?.project !== "image-gen-mcp") {
        throw new Error("Existing group is not owned by this state; refusing adoption.");
      }
      assertOwnedResources(az("resource", "list", "--resource-group", state.group, "--subscription", subscription), state);
    } else if (!quota || quota.limit - quota.currentValue < 1) {
      throw new Error("Insufficient reported quota; request access/capacity rather than changing model or region.");
    }
    const principal = values.auth === "azure-cli" ? az("ad", "signed-in-user", "show").id : "";
    state ??= { version: 1, subscription, group: values.group, groupId, name: values.name,
      location: values.location, ownerToken: randomUUID(),
      resourceId: `${groupId}/providers/Microsoft.CognitiveServices/accounts/${values.name}`,
      endpoint: `https://${values.name}.openai.azure.com/`, deployment: "sunburst" };
    await mkdir(dirname(values.state), { recursive: true, mode: 0o700 });
    if (!hadState) {
      await writeFile(values.state, JSON.stringify(state, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    }
    if (!exists) {
      az("group", "create", "--name", state.group, "--location", state.location, "--subscription", subscription,
        "--tags", "project=image-gen-mcp", `ownerToken=${state.ownerToken}`);
    }
    const args = ["--resource-group", state.group, "--subscription", subscription,
      "--template-file", fileURLToPath(new URL("../infra/main.bicep", import.meta.url)),
      "--parameters", `accountName=${state.name}`, `ownerToken=${state.ownerToken}`, `principalId=${principal}`,
      `assignInferenceRole=${values.auth === "azure-cli"}`];
    az("deployment", "group", "validate", ...args);
    az("deployment", "group", "create", "--name", "image-gen-mcp", ...args);
    process.stdout.write("Deployment succeeded. Non-secret endpoint/resource identifiers are in the private state file.\n");
  }
} catch (error) {
  process.stderr.write(`Azure setup failed: ${error.message}\n`);
  process.exitCode = 1;
}
