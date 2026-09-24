import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { assertPackageInventory } from "../scripts/lib/package-inventory.mjs";

test("package guard rejects unexpected config, nested dependencies and outputs", () => {
  assertPackageInventory(["dist/cli.js", "dist/cli.d.ts", "docs/setup.md", "docs/evidence/onboarding.md"]);
  for (const path of [
    "docs/review-private-config.json", "docs/evidence/private.json", "docs/.private.md",
    "docs/nested/private.md", "dist/private.json", "examples/private.json",
    "examples/presentation/node_modules/private/index.js", "docs/deck.pptx",
    "dist/../private.js", ".env", "assets/generated.png",
  ]) {
    assert.throws(() => assertPackageInventory([path]), /Not in package allowlist/);
  }
});

test("actual npm pack excludes unexpected documentation configuration", async () => {
  const root = await mkdtemp(join(tmpdir(), "image-gen-inventory-"));
  try {
    const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
    await writeFile(join(root, "package.json"), JSON.stringify(manifest));
    const fixtures = {
      "docs/setup.md": "# Setup\n",
      "docs/evidence/onboarding.md": "# Evidence\n",
      "docs/review-private-config.json": '{"env":{"IMAGE_GEN_API_KEY":"synthetic-nonfunctional-key"}}',
      "docs/evidence/private.json": "{}",
      "examples/presentation/node_modules/private/index.js": "",
      "dist/cli.js": "#!/usr/bin/env node\n",
    };
    for (const [path, content] of Object.entries(fixtures)) {
      await mkdir(dirname(join(root, path)), { recursive: true });
      await writeFile(join(root, path), content);
    }
    const npm = process.platform === "win32" ? "npm.cmd" : "npm";
    const [packed] = JSON.parse(execFileSync(npm,
      ["pack", "--dry-run", "--ignore-scripts", "--offline", "--json"],
      { cwd: root, encoding: "utf8" }));
    const paths = packed.files.map((file) => file.path);
    assert.ok(paths.includes("docs/setup.md"));
    assert.ok(paths.includes("docs/evidence/onboarding.md"));
    assert.ok(!paths.includes("docs/review-private-config.json"));
    assert.ok(!paths.includes("docs/evidence/private.json"));
    assert.ok(!paths.some((path) => path.includes("node_modules")));
    assertPackageInventory(paths);
  } finally { await rm(root, { recursive: true, force: true }); }
});
