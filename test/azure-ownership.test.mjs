import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

test("provision and cleanup reject same-ID accounts with foreign/missing ownership or type", { skip: process.platform === "win32" }, async () => {
  const directory = await mkdtemp(join(tmpdir(), "azure-ownership-"));
  const subscription = "00000000-0000-0000-0000-000000000001";
  const groupId = `/subscriptions/${subscription}/resourceGroups/test-owned`;
  const state = { version: 1, subscription, group: "test-owned", groupId, name: "test-account",
    location: "eastus2", ownerToken: "owned-token",
    resourceId: `${groupId}/providers/Microsoft.CognitiveServices/accounts/test-account` };
  try {
    const bin = join(directory, "bin");
    await mkdir(bin);
    const statePath = join(directory, "state.json");
    await writeFile(statePath, JSON.stringify(state));
    await writeFile(join(bin, "az"), `#!${process.execPath}
const fs=require("node:fs");
const args=process.argv.slice(2);
const command=args.slice(0,3).join(" ");
fs.appendFileSync(process.env.MOCK_LOG, command+"\\n");
const state=JSON.parse(fs.readFileSync(process.env.MOCK_STATE,"utf8"));
let result={};
if(command.startsWith("account show")) result={state:"Enabled"};
else if(command.startsWith("provider show")) result={registrationState:"Registered"};
else if(command==="cognitiveservices model list") result=[{kind:"AIServices",model:{name:"gpt-image-2.5-sunburst",version:"2026-09-08",skus:[{name:"GlobalStandard"}]}}];
else if(command==="cognitiveservices usage list") result=[{name:{value:"OpenAI.GlobalStandard.gpt-image-2.5-sunburst"},limit:4,currentValue:1}];
else if(command.startsWith("group exists")) result=true;
else if(command.startsWith("group show")) result={id:state.groupId,tags:{project:"image-gen-mcp",ownerToken:state.ownerToken}};
else if(command.startsWith("resource list")) {
 result=[{id:state.resourceId,type:"Microsoft.CognitiveServices/accounts",tags:{project:"image-gen-mcp",ownerToken:state.ownerToken}}];
 if(process.env.MOCK_SCENARIO==="foreign") result[0].tags.ownerToken="foreign";
 if(process.env.MOCK_SCENARIO==="missing") delete result[0].tags;
 if(process.env.MOCK_SCENARIO==="type") result[0].type="Microsoft.Storage/storageAccounts";
}
console.log(JSON.stringify(result));
`, { mode: 0o700 });
    for (const action of ["provision", "cleanup"]) {
      for (const scenario of ["foreign", "missing", "type"]) {
        const log = join(directory, `${action}-${scenario}.log`);
        const args = ["scripts/azure.mjs", "--action", action, "--state", statePath,
          "--subscription", subscription, "--group", state.group, "--name", state.name,
          "--auth", "api-key", "--confirm", action === "cleanup" ? groupId : "provision"];
        assert.throws(() => execFileSync(process.execPath, args, {
          env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, MOCK_LOG: log, MOCK_STATE: statePath, MOCK_SCENARIO: scenario },
          stdio: "pipe",
        }), /Unowned or unexpected resource/);
        const calls = await readFile(log, "utf8");
        assert.ok(!calls.includes("deployment group"), calls);
        assert.ok(!calls.includes("group delete"), calls);
      }
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
