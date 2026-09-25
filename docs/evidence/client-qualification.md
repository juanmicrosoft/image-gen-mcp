# Installed-client qualification update

Observed 2026-09-25 UTC, macOS arm64, Node 22.22.2,
npm 10.9.7. These observations supersede earlier *unverified* client/auth rows,
not historical failures or unresolved billing outcomes.

## Tested artifact and configuration

The standalone CLI and initial CLI-backed VS Code session used the normal
installed executable from the 69-file candidate
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

Each client run had its own predeclared two-call ledger and used
`scripts/packed-smoke-server.mjs` as a transparent request-counting proxy to the
installed server. The proxy does not replace the provider, obtain keys, or
retry. Standalone CLI, the CLI-backed editor session and the later native
session each finished 2/2. Historical exhausted ledgers were unchanged.

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

## Initial VS Code UI run: CLI-backed session

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
session-scoped tool approvals observed by the operator. Independent review found
the image run was CLI-backed, while separate native chat sessions held the
diagnostic/deadline records. Its successful images must **not** be relabeled as
native Copilot Chat qualification. An unrelated WorkIQ authentication prompt was
not approved by the operator; the final UI alone does not independently establish
every approval decision or absence of other calls.

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

Native Copilot Chat rejected the earlier edit tool's top-level `oneOf` schema.
Issue #66 / PR #67 removed that advertised keyword while preserving exactly-one
source validation on the server. Native discovery and a deliberately invalid
edit were then verified with networking blocked: four tools discovered and
`invalid_input` returned before provider access. The first validation attempt
selected an obsolete same-named server and hit its exhausted budget; only the
post-replacement result qualifies the corrected schema.

## Native Local Copilot Chat: recovery with previews disabled

The corrected installed candidate has SHA-256
`8d11b67277bfe7bb68d2bbe431221cc1deda8dfd2c8a0260dd714cd93dbf8d06`.
All 18 compiled files match reviewed PR #67 commit
`d2118fe716209a126dede8e1ef0de37d1ed4fcb1`; its only packaged difference from
that exact commit is a documentation heading level. This identifies the tested
runtime, not a published or final release tarball.

Native session `177c2b90-7355-4937-b4f8-bb047d9c1ce0` discovered the tools and
generated successfully. After its inline JPEG result was approved, the **host's
next model request** failed with `400 invalid_request_body`, reporting an
upstream file-download 404. Azure generation was already durably successful.
The cause of the host image-transport failure is unverified.
That session used GPT-5.6 Sol; the successful recovery session below used
Claude Sonnet 5. This is not a controlled same-model comparison and does not
establish which change resolved the host transport failure.

There was **no generation retry**. The operator set `IMAGE_GEN_PREVIEW=false`,
restarted the server and opened fresh native session
`53e4fc7f-d941-4a54-8061-75f454d09b03`. `get_operation` recovered the existing
generation, native `view_image` inspected its full-resolution PNG, and the
session used only the original ledger's remaining edit slot. The edited PNG
was then inspected with native `view_image` as well. The edit result required
separate approval, which was delayed overnight; that user wait is not provider
latency. This is a demonstrated recovery workflow, not an uninterrupted
preview-enabled native run.

| Action | Operation ID | Artifact ID | Elapsed | Usage input/output/total |
| --- | --- | --- | --- | --- |
| Generate | `2c76c1e5-4bc0-49f2-a612-e20e83853edc` | `8e2e2498-5257-40f8-96ba-bb50b319514c` | 68,643 ms | 34 / 1078 / 1112 |
| Explicit-source edit | `c28c8f78-dca3-42dc-9b0a-1d82f71806a0` | `849c8e41-644b-4350-8611-e1b0b4299c54` | 55,444 ms | 1334 / 1078 / 2412 |

Generation SHA-256:
`64cb476270ba1804f6a623a298f9734d186a94c144722729dfc275a2b5900829`.
Edit SHA-256:
`8f07127ed162395a50c56030ec866e070d3df4159d5cca2752184d80233b0186`.

Both images fully decode as single-frame 1536x864 PNGs. Source ID/hash match,
and original image and manifest hashes are unchanged. The edit reports
`preview: disabled`. Retained native transcripts and approval records associate
these calls with Local Copilot Chat, not its CLI session provider.
The model described daylight changing to navy twilight/warm horizon and darker
water/reflections. Its phrase "preserved unchanged" is not pixel-preservation
evidence; only the immutable **original file** is proven unchanged.

For this native client/version, disable inline previews explicitly and ask
Copilot to use its local image reader on returned PNG paths. If a host request
fails after image creation, recover with `get_operation`; do not regenerate.
The example now selects preview-off. Native inline-preview reliability is
**not** advertised, and other versions/backends may behave differently.
This recommendation is limited to the observed configuration; it does not
establish compatibility with every host model.

## Native client timing and safety boundaries

In actual VS Code, a local-only 2500 ms tool completed in 2502 ms. Clicking
Cancel during a separate 30000 ms local probe delivered the MCP cancellation
signal 10,278 ms after tool start. The operator's transient click timestamp
preceded the signal by 1 ms, but is not a separately persisted timing trace.
The fixture intentionally does not cancel its underlying timer and completed
at 30,001 ms. Cancellation propagation
does not prove provider cancellation, free billing or a hard wall-clock limit.
The CLI-backed calls and native generation exceeded 60 seconds and completed
without an MCP timeout. Native model processing later failed separately as
described above.
No configurable VS Code hard timeout is claimed from these observations.

[Earlier CLI evidence](copilot-cli.md) separately records measured 1000/5000 ms
client deadlines and preview-off replay with no extra provider request.
Preview-off behavior is not a promise that every client automatically opens
a file; use its image-reading tool explicitly. Same-machine local paths only
are qualified; Windows, WSL, SSH, containers and remote filesystems are not.

The old packed edit in [the earlier run](packed-onboarding.md) remains unknown:
this later success did not recover it or explain its timing anomaly. Strict
data-only authorization was not established by these client runs; see the
[subsequent isolated proof and diagnostic-acceptance refinement](data-only-authentication.md).
Live expired-session behavior remains unverified; npm publication is still a
separate gate. Neither these client runs nor green CI prove those outcomes.
