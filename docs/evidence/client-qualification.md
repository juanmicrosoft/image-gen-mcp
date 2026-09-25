# Installed-client qualification update

Observed 2026-09-25 UTC (2026-09-24 local), macOS arm64, Node 22.22.2,
npm 10.9.7. These observations supersede earlier *unverified* client/auth rows,
not historical failures or unresolved billing outcomes.

## Tested artifact and configuration

Both clients used the normal installed executable from the 69-file candidate
at source commit `91ea5a9e9e4df2edd1c810313f46312ce945afff`, tarball SHA-256
`c2460450360f2e22ef17ae70e37ccb62ab0100a49a9b03d61293ec89a9ea1154`.
Installation was outside the checkout using the
[package verifier](../distribution.md); local installation used a warm cache.
Hosted CI separately proved normal dependency installation. Subsequent runtime
or documentation changes require a new candidate checksum and checks.

The bundled configuration helper selected `IMAGE_GEN_AUTH=azure-cli`, an
explicit tenant and the existing inference endpoint/deployment. No API-key field
or credential fallback was present. A resource-scoped Cognitive Services OpenAI
User grant had been added by an authorized administrator. The normal signed-in
Azure CLI home was intentionally used: this is **not** a blank Azure credential
profile or proof of strictly data-only permissions.

Each client had its own predeclared two-call ledger and used
`scripts/packed-smoke-server.mjs` as a transparent request-counting proxy to the
installed server. The proxy does not replace the provider, obtain keys, or
retry. Both ledgers finished 2/2. Historical exhausted ledgers were unchanged.

## Actual Copilot CLI

Copilot CLI 1.0.79 (`--no-auto-update`) used a fresh `COPILOT_HOME`, a separate
workspace and explicit artifact-directory access. Discovery, previews and two
successful full-resolution `view` calls were recorded.

| Action | Operation ID | Artifact ID | Elapsed | Usage input/output/total |
| --- | --- | --- | --- | --- |
| Generate | `da0a7aa3-7224-4118-9bc6-b31f641df332` | `163229f6-762d-474e-acc2-6cf2dfebd621` | 48,586 ms | 39 / 1078 / 1117 |
| Explicit-source edit | `de0a3d28-d06e-4447-b70f-33a58a62e308` | `2297fa50-e844-4e8b-ac7c-cedf76c8d091` | 70,180 ms | 1349 / 1078 / 2427 |

Generation SHA-256:
`a8c12690598a94766d50879b3836f4b18b29917ba8bd43d814c42b51f2dfe13e`.
Edit SHA-256:
`af8b90645f5363054ec132963f5c6b94e5dcdcdf46d0de27804a37a4d3ef727e`.

Both fully decode as single-frame 1536x864 PNGs. The edit's source ID/hash
matches the original; the original image/manifest remain unchanged. Independent
inspection confirmed cyan daylight changed to navy twilight/orange horizon,
with recognizable arch/terrain/composition. Lighting, reflections and details
also change: semantic continuity is not pixel-identical preservation.

The agent attempted a `sleep 15` shell call for spacing. The host explicitly
denied it; it did not execute. The proxy already handled spacing. This is
approval-boundary evidence, not a claim that the agent never attempted a shell.

## Actual VS Code

VS Code 1.139.0, commit `2242ebbb54efeeb0129e08e919e7e8d43033cd83`,
built-in GitHub Copilot Chat 0.67.0, used separate user-data/extensions/workspace
paths with the existing OS-accessible GitHub sign-in. A fresh profile is not
a new GitHub account or proof of isolated OS credential storage.

An empty `--list-extensions` output did **not** mean built-in Copilot was absent.
The marketplace's older 0.48.1 install was refused as a downgrade. No global
extension installation was performed. A long temporary user-data path failed
the macOS 103-character Unix socket limit; a short task-owned profile fixed
launch. Native-input automation needed UI synchronization; this is test-harness
behavior, not an MCP configuration requirement.

Workspace `.vscode/mcp.json` used top-level `servers`, an explicit Node path,
the bounded proxy and the installed server configuration. Real chat called
`get_capabilities` with credential checking, then generation and editing with
separate session-scoped tool approvals. An unrelated WorkIQ authentication
prompt was not approved; it was not needed for this workflow.

| Action | Operation ID | Artifact ID | Elapsed | Usage input/output/total |
| --- | --- | --- | --- | --- |
| Generate | `12aacdff-a9c0-400e-8248-4db2e7f84167` | `e3043367-bd5a-4d30-b167-4c06541d3c0f` | 60,259 ms | 56 / 1078 / 1134 |
| Explicit-source edit | `c87d3dad-5432-4160-a46d-49d6100e2e15` | `7085155f-989a-4ded-ae44-e7195beed252` | 60,826 ms | 1362 / 1078 / 2440 |

Generation SHA-256:
`2a548f7764046d9d756828d28937b8a49c51f28ced537346e279c2bb0bb7ff51`.
Edit SHA-256:
`ab6d0554618c9bd167cb08b4ba074cc82a3a0af2e38a2f279d79b0a61656e4de`.

Both fully decode as 1536x864 PNGs with verified source ID/hash lineage. The UI
records successful full-resolution image reads and describes the shift from
cyan daylight to navy clouds/orange horizon, with changed light and shadows.
Result paths were accessed, not merely printed. Synthetic images and raw client
records remain private; only sanitized summaries/hashes are published.

## Client timing and safety boundaries

In actual VS Code, a local-only 2500 ms tool completed in 2502 ms. Clicking
Cancel during a separate 30000 ms local probe delivered the MCP cancellation
signal 1 ms after the recorded click, 10,278 ms after tool start. The fixture
intentionally does not cancel its underlying timer. Cancellation propagation
does not prove provider cancellation, free billing or a hard wall-clock limit.
The live image calls exceeded 60 seconds and completed without cancellation.
No configurable VS Code hard timeout is claimed from these observations.

[Earlier CLI evidence](copilot-cli.md) separately records measured 1000/5000 ms
client deadlines and preview-off replay with no extra provider request.
Preview-off behavior is not a promise that every client automatically opens
a file; use its image-reading tool explicitly. Same-machine local paths only
are qualified; Windows, WSL, SSH, containers and remote filesystems are not.

The old packed edit in [the earlier run](packed-onboarding.md) remains unknown:
this later success did not recover it or explain its timing anomaly. Strict
data-only authorization, live expiry/negative-case coverage and npm publication
remain separate gates. Neither this record nor green CI closes them.
