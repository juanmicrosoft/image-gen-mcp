# Actual Copilot CLI integration

**Update:** [Later installed-client evidence](client-qualification.md) proves
CLI-token generation/editing and full-resolution inspection in both local
Copilot CLI and VS Code. Earlier unverified rows below are historical.

Issue #21, observed 2026-09-24, macOS arm64, Node 22.22.2. The test used the
installed **Copilot CLI 1.0.79** with `--no-auto-update`; the automatically
selected agent model reported `claude-sonnet-5`. This is the Copilot reasoning
model, not the Azure image renderer. Unpinned `copilot --version` reported a
different cached version, so it is not the tested-version claim.

An isolated `COPILOT_HOME`, session-local `--additional-mcp-config`, disabled
built-in MCP servers/custom instructions, and explicit
`--allow-tool=image-gen --allow-tool=view --deny-tool=shell --deny-tool=write`
were used. Approval UI behavior was not tested; the named tools were deliberately
preapproved for this bounded test. No global client configuration was changed.

## Observed complete local workflow

The actual client discovered all tools, called diagnostics, generated A, opened
A's original PNG with its built-in `view`, edited **that explicit artifact** into
B, and opened B's original PNG. Both image-tool results contained structured
metadata and `binaryResultsForLlm`; both `view` calls succeeded. The model
described the telescope through the dome slit, circular railing, distant snowy
peak and foggy valley, then recognized the coral sky change. Independent image
inspection confirmed those visible features. This proves model inspection with
the combined preview/local-view workflow, not preview-only inspection in isolation.

The separate purpose-specific client ledger was fixed at two requests and ended
at exactly two. Both HTTP results were 200: 48,771 ms generation and 57,075 ms edit
(provider headers timing, not total Copilot turn latency). No retries occurred.
Full-resolution images were 1536x864 PNGs with verified immutable hashes:

- A: `2ff7c1c6a302ec3ae380b5cc5d45addd7be5bf755af8d32d647482482fd14f98`;
  usage 38 input / 1078 output / 1116 total.
- B: `4e9f103315b119120f82f4ebd7e4e9d9625d6961f65939ee74c71a0f997a555b`;
  usage 1341 input / 1078 output / 2419 total; source hash matches A.

The model's prose conflated operation and artifact IDs and overstated
"only the sky" changing. The structured tool result is authoritative: the IDs
are distinct, and illumination/reflections also changed. Do not promote those
prose mistakes into product guarantees.

For user viewing, `open -a Preview /absolute/artifact/image.png` exited
successfully for A. Pixels were independently inspected with the image-reading
tool; no claim of observing a human interact with the Preview UI is made.
Resource links were not relied upon.

## Measured deadlines, not inferred defaults

`test/fixtures/deadline-server.mjs` is a local nonbillable 2500 ms tool. Against
the same actual CLI, explicit `timeout: 1000` produced one timed-out invocation;
`timeout: 5000` produced one successful invocation. Neither was retried. This
supports configurable synchronous operation; the real image workflow used
240000 ms, while the server's network deadline is 180000 ms.
It does not establish a universal default or that cancellation prevents charges.
The short-deadline fixture received cancellation 1004 ms after start; the
long-deadline fixture completed after 2502 ms. No Azure request was involved.

A separate actual CLI call replayed A's original operation and exact prompt with
`IMAGE_GEN_PREVIEW=false`. It returned `preview: disabled`, zero
`binaryResultsForLlm`, and the client ledger remained at two. Thus preview-off
does not require another generation and does not send inline image content.

## Remaining limits

The developer smoke server retrieved a key for the isolated test resource; it
does not prove CLI-token inference or a data-only principal. Those remain #11.
VS Code 1.139.0 arm64 was present, but `code --list-extensions` showed no Copilot
extension. No authenticated VS Code image workflow or deadline is established.
Issue #21 therefore stays open for that acceptance gate. No Windows, Linux,
WSL, container or remote-filesystem support is claimed by this run.

Raw client transcripts (including image bytes), manifests and ledgers remain
private in ignored `.local/`; only sanitized evidence is committed.
