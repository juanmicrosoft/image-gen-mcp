# Local package verification and support boundaries

Registry publication is **not verified**. The local package is named
`@juanmicrosoft/image-gen-mcp`, version `0.1.0`; that metadata is not evidence of
npm scope ownership or publication. `npm whoami` returned `ENEEDAUTH`, and later
registry lookups failed with connection/TLS errors. Do not install an assumed
public version in place of the reviewed source/tarball.

From a source checkout with dependencies installed:

```sh
npm run verify:package -- --output "$PWD/.local/packages"
```

If registry access is unavailable and the required dependencies are already in
the local npm cache, explicitly add `--offline`. This is a **warm-cache** check,
not proof that a new machine can download dependencies offline.

The verifier cleans generated `dist`, builds, packs with an explicit allowlist,
rejects private/dotfiles, nested dependencies and generated decks/images,
installs the tarball outside the checkout, verifies executable permissions,
initializes the actual installed bin and discovers all four tools without Azure
credentials. It also checks relative Markdown links in the installed package.
It retains the tarball and a private `evidence.json` containing paths/checksum.
The temporary installed prefix is retained for optional further checks.

Runtime dependencies include Azure Identity, the MCP SDK, Zod and Sharp.
PptxGenJS remains only in the standalone example manifest; its installed
`node_modules` must not enter the package. Provisioning, tests and release
commands are source-checkout workflows, not commands promised inside the
installed runtime package. The private client-config helper is included.

To use a locally verified tarball in your chosen persistent prefix:

```sh
npm install --prefix /absolute/private/mcp-install /absolute/verified-package.tgz
node /absolute/private/mcp-install/node_modules/@juanmicrosoft/image-gen-mcp/scripts/configure-client.mjs \
  --output /absolute/private/copilot.mcp.json
```

Select runtime environment/authentication first as in [setup](setup.md).
Key mode additionally requires `--allow-plaintext-key`; protect the resulting
0600 file. Do not use a temporary verification prefix as a permanent registration.

## Dated observations, not blanket support

See [the package/onboarding run record](evidence/packed-onboarding.md).
The source-build macOS/API-key/Copilot CLI workflow has successful generation,
editing and inspection evidence. A fresh packed run proved installation,
discovery, generation and read-only artifact recovery, but its single edit ended
`outcome_unknown`; that successful packed-edit gate remains **open**.

Other end-to-end operating-system/client/auth combinations—including Windows
path/spawn behavior, VS Code, WSL, containers and remote filesystems—are not
advertised as validated. Minimum Node engine metadata is not proof of every
later Node version. Offline CI checks are separate from real client/inference
support; do not extrapolate one into the other.

The developer-only `scripts/packed-smoke-server.mjs` bounds forwarded image calls
to the normal installed executable and spaces requests without retrying them.
It does not retrieve management keys or replace the provider adapter. Keep a
failed/unknown operation and exhausted ledger; use local `get_operation` rather
than silently resetting limits or submitting another edit.
