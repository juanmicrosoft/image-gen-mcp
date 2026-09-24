# Local artifact contract

Use a private, explicitly selected absolute output directory on a local
filesystem. Do not share a writable root with untrusted processes. Local OS user
compromise and filesystems that ignore `fsync` are outside the durability model.
Unsupported directory sync fails closed.

Each UUID has an immutable `image.png` and versioned `manifest.json`. The manifest
contains dimensions, SHA-256, creation time, deployment/model evidence status,
requested options and optional source ID/hash, safe request ID and usage. It contains no
prompt, API key or source filename. Artifacts remain until explicitly removed by
the operator; no automatic age-based deletion is performed.

The decoder verifies PNG signature, format, full decode, byte/pixel/dimension
limits, a single frame and no rotated EXIF orientation. Requested output
dimensions must match decoded bytes. PNG metadata is preserved in the original
bytes; do not assume that a reference/provider image is stripped of metadata.
Local references must be regular `.png` files in approved roots without symlinked
paths. Bounded PNG chunk parsing rejects APNG animation chunks independently of
decoder metadata. Images and manifests reject special files before opening and
use nonblocking, no-follow descriptor checks as defense in depth. Artifact
retrieval rechecks hashes and dimensions; mutation is an error.

An exclusive `.claim-UUID` prevents ID reuse. Saving writes and syncs both files
in a private `.pending-UUID` directory, syncs directory ancestors, then renames
and syncs the root. Failures are explicit; a pending directory/claim may remain
for diagnosis and is never automatically reused. A provider request may already
have succeeded when persistence fails. Retrieve a committed UUID before deciding
whether another billable request is appropriate.

Requested quality is retained when Azure omits it; a contradictory returned
quality fails before saving. Missing usage is unknown, not zero.
Tests: `npm test` (artifact and stdio suites). Broader disk-failure and process
interruption boundaries are recorded in [reliability evidence](evidence/reliability.md).
