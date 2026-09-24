import assert from "node:assert/strict";

const allowedFiles = new Set([
  "package.json", "README.md", "LICENSE", "CONTRIBUTING.md", "SECURITY.md", "AGENTS.md", "CHANGELOG.md",
  "assets/image-gen-mcp.png", "evaluation/briefs.json", "scripts/configure-client.mjs",
  "examples/copilot-cli.mcp.json", "examples/vscode.mcp.json",
  "examples/presentation/README.md", "examples/presentation/build.mjs",
  "examples/presentation/test.mjs", "examples/presentation/package.json",
  "examples/presentation/package-lock.json",
]);

export function assertPackageInventory(files) {
  for (const path of files) {
    assert.ok(
      allowedFiles.has(path) ||
      /^dist\/[a-z][a-z0-9-]*(?:\.js|\.d\.ts)$/.test(path) ||
      /^docs\/(?:evidence\/)?[a-z][a-z0-9-]*\.md$/.test(path),
      `Not in package allowlist: ${path}`,
    );
  }
}
