# Generation and recovery

`generate_image` requires a nonempty `prompt` (up to 32,000 characters) and a
caller-created UUID `operation_id`. Retain that ID before submitting. Optional
`size` and `quality` default to the only enabled, live-verified combination:
`1536x864` and `high`. Other options, formats, counts and dimensions fail before
submission; the server never silently substitutes options or rewrites prompts.

The typed native REST adapter uses the [proven Azure route](evidence/azure-contract.md),
one image per call, redirect refusal, a 180-second network deadline and bounded
response/image decoding. There are no automatic retries. Client deadlines should
exceed the server deadline plus local persistence/preview processing; a shorter
client deadline does not prove that inference stopped or was free.

Results include the immutable full-resolution PNG path, artifact/operation IDs,
MIME type, dimensions, SHA-256, configured model/deployment evidence, safe request
ID if provided, and Azure usage counters if provided. Missing usage is `null`.
Usage is persisted in the artifact manifest and survives replay/restart. No
prompt, key, token or raw provider exception is stored in that manifest.
The manifest quality records the requested option, not a visual-quality
measurement. If Azure returns a quality field, it must equal `high`; contradictory
or malformed values fail before saving. If absent, the requested option is
retained without claiming provider-reported confirmation.

With previews enabled, an additional MCP **image** content block carries a
JPEG thumbnail, at most 512 pixels per edge and 256 KiB. This does not replace,
resize or modify the full-resolution PNG. `IMAGE_GEN_PREVIEW=false` disables it.
The structured result records disabled/size-omitted previews. Image content is
sent to the MCP client/model; filesystem paths alone do not prove image visibility.

Replaying the same ID and semantic arguments returns the saved artifact without
another provider call. Changing arguments with the same ID fails. Use
`get_operation` after a lost response; it never calls Azure. Ambiguous, failed
and stale-lock operations are never automatically resubmitted. Inspect
[recovery guidance](recovery.md) before any explicit new submission.

Configuration and storage initialize lazily. Diagnostics remain available when
configuration is broken. An operation error includes its valid operation ID,
safe error category and uncertainty guidance; it does not expose raw responses.

## Bounded real MCP smoke check (development checkout)

After `npm run build`, configure the runtime environment explicitly as documented
in [configuration](configuration.md), then:

```sh
IMAGE_GEN_LIVE=true IMAGE_GEN_MAX_REQUESTS=8 \
  node scripts/smoke-mcp.mjs \
  --ledger "$PWD/.local/probe-budget.json" \
  --record "$PWD/.local/mcp-generation.json" \
  --prompt "Editorial cyan observatory at right; dark navy negative space at left; no text."
```

Use the existing approved ledger and its unchanged limit. The harness persists
an exclusive attempt record before starting, consumes one request before calling
the real stdio tool, retains sanitized structured evidence without preview
base64, and refuses reuse of the record path. It does not retrieve management
keys or change credentials. Failed attempts count; never delete the ledger to
bypass its bound. A successful response must still be visually inspected.
