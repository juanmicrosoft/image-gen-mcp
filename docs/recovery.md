# Operation identity and recovery

Each generation/edit requires a caller-selected UUID. Reuse that ID only with
the same effective arguments. The store hashes a canonical argument map (never
credentials), assigns an artifact UUID before submission, and persists a synced
`started` record before invoking the provider. It never persists the prompt
itself; a fingerprint is not an anonymization guarantee for guessable inputs.

A known success replays its verified artifact without another callback.
Changed arguments conflict. A timeout, interruption or unexpected error is
`outcome_unknown`, not permission to try again. A definitive provider failure can
be marked `failed`; even then a new submission requires an explicit new ID.
Cancellation does not guarantee provider cancellation or nonbilling.

The private `.operations` directory and `.in-flight` lock serialize requests
across processes using the same output root. After a process crash, a stale lock
blocks new submissions. Read-only status/replay still verifies a saved artifact
and can recover a success even if the final operation update/response was lost.
Do not delete a lock until its old process is stopped and its upstream outcome
has been investigated. Never delete an operation record to bypass uncertainty.

The same private-local-filesystem/fsync assumptions as [artifacts](artifacts.md)
apply. Missing or corrupted completed artifacts are errors, not regeneration
triggers. This is not an exactly-once guarantee from Azure; it is conservative
local no-automatic-resubmission behavior.

The MCP `get_operation` tool is implemented. See
[actual CLI deadline evidence](evidence/copilot-cli.md) and
[process-kill/fault evidence](evidence/reliability.md); VS Code remains unverified.
Tests cover replay, conflicts, uncertain failures, post-save interruption/restart
and concurrent exclusion. [Operations guidance](operations.md) explains privacy,
retention and explicit cleanup without bypassing uncertain outcomes.
