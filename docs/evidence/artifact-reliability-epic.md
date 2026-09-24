# Epic #4 integration evidence

Observed 2026-09-24. This is the dedicated closure record, not a replacement for
the independently reviewed child implementations:

| Child | Dedicated merged PR | Accepted outcome |
| --- | --- | --- |
| #18 | [#37](https://github.com/juanmicrosoft/image-gen-mcp/pull/37) | Bounded full PNG validation; immutable image/manifest commits; hash verification |
| #19 | [#41](https://github.com/juanmicrosoft/image-gen-mcp/pull/41) | Durable operation identity, shared-root admission, conservative replay/recovery |
| #20 | [#42](https://github.com/juanmicrosoft/image-gen-mcp/pull/42) | Sanitized typed MCP errors, explicit uncertainty and honest usage |

The completed generation/edit integrations ([#46](https://github.com/juanmicrosoft/image-gen-mcp/pull/46),
[#47](https://github.com/juanmicrosoft/image-gen-mcp/pull/47)) exercise these
components together, rather than only as isolated helpers. Real image results
retain dimensions, hashes, configured model evidence, available usage and edit
source lineage. The [actual CLI workflow](copilot-cli.md) additionally proves
same-ID replay with previews disabled returned the original artifact without
increasing its exhausted two-request ledger.

The [fault-injection record](reliability.md) checks actual process interruption
after submission, artifact commit and durable success, plus mocked timeout,
policy, malformed output and disk-full boundaries. Every new fault case records
local state and submission count and checks that original bytes/manifests remain
unchanged. Independent mutation probes established that the suite fails if
replay resubmits or the durable pre-submission record is omitted.

Errors traverse actual stdio as `isError`, with safe authored messages rather
than raw provider/credential exceptions. Unknown usage stays null. Quality
contradictions fail before persistence; absent quality retains the requested
option without claiming provider confirmation.

Limits are deliberate: a new caller-selected ID can be a new billable request;
this is not provider-side exactly-once billing. Remote completion can remain
unknown when bytes never commit. Stale locks fail closed; hostile shared local
mutation, hardware power loss, remote filesystems and unsupported platforms are
not covered by the local durability claim. See [operations](../operations.md)
and [recovery](../recovery.md).

All three children are closed through their own reviewed PRs. This epic can
close independently of Azure CLI authorization (#11), VS Code (#21) and registry
publication (#30), which remain separate gates and are not implied by storage
and recovery evidence.
