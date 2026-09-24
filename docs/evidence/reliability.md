# Reliability and fault-injection evidence

Issue #24. The deterministic offline cases in `test/faults.test.mjs` assert
provider submission counts **and** durable state, replay behavior and unchanged
original image/manifest bytes. Fixtures submit no real image requests.

| Boundary | Count | Durable result | Replay |
| --- | ---: | --- | --- |
| Unreadable pre-submit operation record | 0 | Explicit local failure; no new artifact | Refused |
| Already-cancelled tool request | 0 | No operation record | No submission in test |
| Cancellation/timeout after mocked submission | 1 | `outcome_unknown`, no committed artifact | Refused |
| Definitive policy rejection | 1 | `failed` | Refused |
| Malformed PNG after submission | 1 | `outcome_unknown`, no artifact | Refused |
| ENOSPC while writing manifest | 1 | Pending file only, no committed artifact | Refused |
| Actual worker SIGKILL after submission | 1 | Started record resolves to unknown | Refused |
| Actual worker SIGKILL after artifact commit | 1 | Artifact recovered from started record | Original artifact, zero additional calls |
| Actual worker SIGKILL after durable success/before delivery | 1 | `succeeded` | Original artifact, zero additional calls |

Process interruption tests launch a real worker, wait for a phase marker,
terminate that specific process with SIGKILL and reopen storage. They count a
flushed provider-submission marker, not merely calls in the parent test process.
A stale shared-root lock after interrupted active work blocks unrelated new
operations; recovered replays can still return already committed artifacts.

Existing artifact/operation suites additionally cover concurrent admission,
conflicting operation arguments, immutable IDs, mutated sources, invalid roots,
FIFO/APNG rejection and persistence failures. These are tested local behaviors,
not exactly-once billing guarantees.

## Residual windows

If Azure accepts a request but the response or local commit is lost, the server
cannot prove remote completion or recover unsaved bytes. It will not submit
again automatically. Filesystem failure can prevent writing even the final
unknown-state record; inspect existing records and stale locks. Local operation
IDs are not provider-side idempotency keys. Timeouts and cancellation do not
establish zero charges.

SIGKILL is not a power-loss test. Directory/file syncing fails closed when the
filesystem cannot supply it, but no guarantee is made for hardware failure,
network filesystems, hostile concurrent local mutation or untested platforms.
Never remove a lock simply because a client timed out; follow
[recovery guidance](../recovery.md).
