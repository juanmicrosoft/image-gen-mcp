# Error and usage contract

Tool failures return MCP `isError: true` and a structured error with a stable
category, actionable authored message, optional sanitized request ID, completion
certainty, `automaticRetry: false`, and billing `unknown`. A definitive HTTP
rejection is a failed operation, **not** proof it cost nothing. Server/network
failures and cancellation can leave the provider outcome unknown.

Categories distinguish invalid input, authentication, permission, endpoint/
deployment, content policy, quota, throttling, network, timeout, invalid provider
output, persistence and operation conflict/busy/unknown state. Unexpected errors
are explicit sanitized internal failures, never successful empty results.
Raw provider error bodies, exception messages, credentials, prompts and image
bytes are not included in these error results.

Policy rejection never triggers prompt rewriting, model switching or automatic
retry. HTTP 429 requires an explicit later decision; the same operation ID is
not resubmitted. Check state before choosing a new ID. Local persistence errors
can follow successful, billable inference.

Only supplied nonnegative integer usage counters are retained. Missing usage is
`null`, not zero; malformed counters are explicit provider-output errors.
Usage is not a price quotation or invoice. See [live cost guidance](live-testing.md).

Tests: `npm test`, including the error mapping/redaction/usage cases.
