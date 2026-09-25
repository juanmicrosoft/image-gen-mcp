# Explicit reference editing

`edit_image` uses the same operation ID, prompt, size and quality contract as
[generation](generation.md). Supply **exactly one**:

- `source_artifact_id`: a previously returned artifact UUID in this output root.
- `source_path`: an absolute `.png` path inside `IMAGE_GEN_INPUT_DIRS`.

Sources must be bounded, fully decodable, nonanimated regular PNG files.
Symlinks, URLs, masks and multiple references are rejected. The server never
selects a newest image or substitutes another source. Changed/missing artifacts
fail before submission; local input bytes are snapshotted and hashed before the
single-reference multipart call. The private source path is not in the manifest.

Each output gets a new immutable artifact. Its manifest retains the exact source
hash and, for artifact-based edits, parent artifact ID. Editing A into B does not
alter A; after restart you can explicitly edit A into C. The edit instruction
must be self-contained; there is no retained image conversation or automatic
prompt rewrite. Semantic preservation and style continuation are probabilistic,
not pixel-identity guarantees.

Reusing an ID requires the same request and source bytes. Replays still validate
the explicit source; if it has been removed, use `get_operation` to recover the
already committed result without reading that source or calling Azure.

For a bounded real stdio edit smoke check, use `scripts/smoke-mcp.mjs` as in the
generation guide, with a fresh record path, the same approved ledger and
`--source-artifact YOUR_SOURCE_ARTIFACT_UUID`. Supply an explicit edit brief via
`--prompt`. This is billable; failed/unknown attempts count and are not retried.
## Client schema compatibility

The advertised tool schema is a plain top-level object: native VS Code Copilot
Chat 0.67.0 rejects top-level `oneOf` tool schemas. Field descriptions explain
the exclusive choice, and server-side validation still rejects both sources or
neither source before configuration, operation creation or provider submission.
Client-side schema acceptance does not replace this server-side check.
