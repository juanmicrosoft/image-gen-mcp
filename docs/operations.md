# Privacy, operations and troubleshooting

This guide describes the implemented v1 contract and the dated
[Azure](evidence/azure-contract.md), [client](evidence/copilot-cli.md),
[reliability](evidence/reliability.md) and [quality](evidence/visual-evaluation.md)
evidence. A documented model feature is not automatically an enabled server
option; a local fixture is not a successful live authorization test.

## Data boundaries and retention

Copilot receives the user's request and chooses tool arguments. The local MCP
sends the exact supplied image prompt and, for editing, one selected PNG to the
configured Azure inference endpoint. Returned images are saved locally; a
bounded optional JPEG preview is also returned to the client/model. Copilot can
read the full-resolution file separately on the same filesystem. These are
distinct data boundaries, not an entirely offline workflow.

The runtime does not persist raw prompts or credentials in artifact/operation
records. It retains request fingerprints, deployment/configured model evidence,
options, timestamps, image hashes/dimensions, source lineage, available usage
and safe request IDs. Fingerprints are not anonymization for guessable prompts.
Images can themselves contain sensitive content or PNG metadata, and original
bytes are not stripped of metadata. Source filenames are not in manifests.

Client conversations/transcripts and Azure service processing have their own
retention policies; a local no-prompt manifest does not remove prompts/images
from those systems. `IMAGE_GEN_PREVIEW=false` suppresses the inline thumbnail,
but does not prevent Copilot from opening a returned path or Azure from receiving
the prompt/reference. Use non-sensitive inputs unless you have reviewed all
applicable policies. The repository has no custom telemetry exporter; do not
interpret that as a privacy guarantee about clients, credentials or services.

Use a private local output root. Back up the entire root if you need consistent
operation/manifest/image recovery. No automatic artifact expiration is performed.
Before intentionally deleting a specific artifact UUID directory, stop active
work and preserve any required originals/backups. Deletion breaks successful
operation replay; it does not authorize regeneration. Do not delete operation
records or claims to bypass conflicts or billing uncertainty. Never use a broad
repository/home-directory cleanup command.

## Uncertain completion and safe recovery

Retain the caller-created operation UUID before submission. After a timeout,
connection loss or lost client response, use `get_operation` with that same ID.
If an artifact committed, it can be recovered even when the final operation
update was interrupted. If no artifact committed, remote completion and charges
can remain unknown. Neither timeout nor cancellation proves that Azure stopped.

The shared-root lock serializes submissions. A crash can leave a stale lock;
new requests then fail busy instead of guessing that the old request is safe
to repeat. Confirm the old process is stopped, inspect operation/artifact state
and investigate the upstream outcome before manually removing that exact stale
lock. Do not run a second server with a different root to evade the lock.
Even a definitive failed operation is not automatically retried with a new ID.

See [recovery](recovery.md) for durable states and
[fault evidence](evidence/reliability.md) for tested boundaries and residual
failure windows. There is no Azure exactly-once/idempotency guarantee.

## Actionable failures

| Symptom/category | Action and evidence boundary |
| --- | --- |
| Configuration / `invalid_input` | Use the resource root `https://NAME.openai.azure.com/`, not a project/deployment URL. Use an explicit alias and absolute output directory. Only 1536x864/high/PNG/n=1 is enabled. Schema tests reject alternatives before submission. |
| CLI credential acquisition | Check `az login` for the intended tenant and CLI PATH visible to the client. A syntactically valid tenant UUID can still be wrong. Do not paste raw credential errors/tokens into issues. Offline selection tests are not live authorization proof. |
| `authentication` / `permission` | Verify the selected credential and resource-scoped inference permissions. The current CLI principal returned live 401 `PermissionDenied`; management access and a token did not suffice. An administrator is needed for #11; do not grant subscription Owner as a shortcut. |
| API key conflict | Explicitly select `IMAGE_GEN_AUTH=api-key`; remove CLI-only `AZURE_TENANT_ID`. Conversely remove the key in CLI mode. No fallback occurs. Never put keys in committed configuration. |
| `deployment` | Check the exact endpoint and deployment alias with the resource owner. Diagnostics deliberately do not require management-plane discovery. An alias is not a model identity. |
| `network` / `timeout` / unknown outcome | Check DNS, TLS, approved proxies/firewall and endpoint access without disabling certificate verification. Retain the operation ID; lookup before any explicit new submission. Offline network/cancellation cases prove classification, not every corporate network configuration. |
| `throttled` / `quota` | Inspect Azure rate/quota/capacity with an authorized operator. The observed 429 was recorded, not retried automatically. Catalog/quota presence is not throughput. |
| `policy` | Review the content against applicable service rules; the server does not rewrite, switch models or retry to evade a rejection. Policy mapping is covered offline, not claimed as a live content-filter evaluation. |
| `provider_output` | Inspect the retained operation. Malformed bytes, wrong dimensions/format/quality and invalid usage are rejected; a request may already have incurred charges. Do not silently accept a different option. |
| `persistence` / missing or changed source | Check disk space, permissions, approved roots and the exact artifact. Special files, symlinks, APNG and changed hashes fail explicitly. On macOS use canonical paths (`pwd -P`); `/var` aliases may resolve to `/private/var`. Never choose another image automatically. |
| `busy` / `conflict` / `previous_failure` | Inspect the stored operation, input identity and shared-root lock. Do not delete records or blindly choose another UUID. |
| Package/native module/startup | Use the documented Node version and recorded platform matrix. Reinstall from the matching lockfile after an actual missing-dependency failure; don't assume untested platforms work. Keep server stdout JSON-RPC only; diagnostics belong on stderr. |

Auth subcauses such as expired login versus wrong tenant are not always
distinguishable from a generic 401. The server must not invent that diagnosis.
See [error semantics](errors.md) for safe categories, usage and billing unknowns.

## Costs, geography and infrastructure cleanup

Image requests can be billable even when a client cannot recover the result.
Missing usage is unknown, not zero. Reported token counters are not your invoice.
Use [Azure-specific pricing and processing sources](live-testing.md); budget
alerts are not hard caps, and GlobalStandard does not guarantee processing in
the selected resource region. Developer test ledgers are request-count bounds,
not dollar limits and not a runtime quota for ordinary user requests.

The normal MCP never provisions, enumerates resources or retrieves management
keys. Provisioning and explicitly gated developer probes are separate.
For infrastructure removal, use the owner-tagged exact-group cleanup flow in
[Azure setup](azure-setup.md). It refuses foreign/unexpected resources and does
not purge soft-deleted accounts. Do not replace it with a broad subscription
cleanup. Retain private ownership state until deletion is confirmed.

## Deliberate v1 exclusions and unresolved support

No Astra/separate planning model, additional image models, remote MCP hosting,
remote filesystems, batch images, masks, multiple references, remote image URLs,
transparency controls, experimental/custom sizes or general slide editor.
Copilot supplies creative direction; presentation tools consume immutable PNGs.
Reference editing and style continuity are probabilistic, not pixel-preserving.
No exact ChatGPT model routing or output parity is claimed.

The dated evidence proves the local macOS/Copilot CLI/API-key workflow only.
CLI-token inference, a strict data-only principal, VS Code, other operating
systems/remote arrangements and npm publication retain explicit gates in the
milestone. Source availability and MIT licensing do not replace Azure/OpenAI
terms or guarantee rights in source/generated imagery.
