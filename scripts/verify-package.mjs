import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const { values } = parseArgs({ options: {
  output: { type: "string" }, offline: { type: "boolean", default: false },
} });
const root = fileURLToPath(new URL("../", import.meta.url));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
if (!values.output || !isAbsolute(values.output)) throw new Error("Provide an absolute --output directory for retained package evidence.");
await mkdir(values.output, { recursive: true, mode: 0o700 });
const out = await mkdtemp(join(values.output, "package-"));
execFileSync(npm, ["run", "build"], { cwd: root, stdio: "inherit" });
const [packed] = JSON.parse(execFileSync(npm, ["pack", "--ignore-scripts", "--json", "--pack-destination", out], { cwd: root, encoding: "utf8" }));
const files = packed.files.map((file) => file.path);
for (const path of files) {
  assert.ok(!/(^|\/)(?:node_modules|\.[^/]*)(?:\/|$)/.test(path), `Private/unexpected packed path: ${path}`);
  assert.ok(!/\.(?:pptx|pdf|tgz)$/.test(path), `Generated output in package: ${path}`);
  assert.ok(!path.endsWith(".png") || path === "assets/image-gen-mcp.png", `Unexpected image: ${path}`);
  assert.ok(/^(?:dist\/|docs\/|examples\/|evaluation\/briefs\.json$|scripts\/configure-client\.mjs$|assets\/image-gen-mcp\.png$|package\.json$|README\.md$|LICENSE$|CONTRIBUTING\.md$|SECURITY\.md$|AGENTS\.md$)/.test(path), `Not in package allowlist: ${path}`);
}
for (const expected of ["dist/cli.js", "docs/setup.md", "scripts/configure-client.mjs", "LICENSE", "examples/presentation/build.mjs"]) assert.ok(files.includes(expected));
const tarball = join(out, packed.filename);
const installRoot = await mkdtemp(join(tmpdir(), "image-gen-package-"));
assert.ok(relative(root, installRoot).startsWith(".."), "Installation must be outside the checkout.");
execFileSync(npm, [
  "install", "--prefix", installRoot, "--ignore-scripts", "--no-audit", "--no-fund",
  ...(values.offline ? ["--offline"] : []), tarball,
], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const packageRoot = join(installRoot, "node_modules", "@juanmicrosoft", "image-gen-mcp");
for (const path of files.filter((file) => file.endsWith(".md"))) {
  const markdown = await readFile(join(packageRoot, path), "utf8");
  for (const match of markdown.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const target = match[1].split("#")[0];
    if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
    const resolved = resolve(packageRoot, dirname(path), target);
    assert.ok(!relative(packageRoot, resolved).startsWith(".."), `Documentation link escapes package: ${path}`);
    await stat(resolved);
  }
}
const entrypoint = join(packageRoot, "dist", "cli.js");
const bin = join(installRoot, "node_modules", ".bin", process.platform === "win32" ? "image-gen-mcp.cmd" : "image-gen-mcp");
if (process.platform !== "win32") assert.ok((await stat(entrypoint)).mode & 0o111, "Installed executable needs execute permission.");
const client = new Client({ name: "clean-packed-install", version: "1" });
const transport = new StdioClientTransport({ command: bin, args: [], env: { PATH: process.env.PATH, HOME: installRoot }, stderr: "pipe" });
let stderr = "";
transport.stderr?.on("data", (chunk) => { stderr += chunk; });
try {
  await client.connect(transport);
  assert.deepEqual((await client.listTools()).tools.map((tool) => tool.name).sort(),
    ["edit_image", "generate_image", "get_capabilities", "get_operation"]);
  const result = await client.callTool({ name: "get_capabilities", arguments: {} });
  assert.equal(result.structuredContent.checks.inference.status, "unverified");
} finally { await client.close(); }
assert.equal(stderr, "");
const evidence = {
  recordedAt: new Date().toISOString(), os: process.platform, arch: process.arch, node: process.version,
  npmOffline: values.offline, name: packed.name, version: packed.version,
  tarball, sha256: createHash("sha256").update(await readFile(tarball)).digest("hex"),
  fileCount: files.length, files, installRoot, packageRoot, entrypoint, bin,
  discovery: "passed", inference: "not requested; unverified",
};
await writeFile(join(out, "evidence.json"), JSON.stringify(evidence, null, 2) + "\n", { flag: "wx", mode: 0o600 });
process.stdout.write(JSON.stringify(evidence, null, 2) + "\n");
