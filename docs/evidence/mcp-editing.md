# Runtime editing evidence

Issue #17, observed 2026-09-24 on macOS arm64, Node 22.22.2, SDK 1.30.0 and the
same explicit API-key Sunburst deployment as [runtime generation](mcp-generation.md).

The real stdio `edit_image` call consumed request **7 of the existing 8-request
ledger** and completed in **55,245 ms**. It explicitly referenced generation A,
not a newest-image heuristic. Result B is a fully decoded 1536x864 PNG:

- A SHA-256: `f746ff5c0489c96576a893ebabdfb93acc5572770ede43e44f83740943261512`.
- B SHA-256: `9d6b659b4a2008d701fbaf023779f3c7226698f9cf11beb241009e981904e360`.
- Persisted lineage: A's exact artifact ID and hash; independent re-read
  confirmed A remained unchanged.
- Usage: 1346 input / 1078 output / 2424 total tokens; safe request ID present;
  one bounded MCP image preview.

Visual inspection: the sky changed from cyan night to coral sunrise while the
observatory and major mountain layout remained recognizable. Illumination,
clouds and reflections also changed; this is semantic preservation, **not**
pixel-identical untouched content. Dark left-side text space remained.

The explicit edit brief and reproducible `--source-artifact` smoke invocation
are described in [editing](../editing.md). Private records/images stay in
ignored `.local/`; no credential or user-specific path is committed.

An offline real-stdio test starts a child server, generates A, edits A into B,
closes/restarts the process, then edits A into C. It verifies both parent IDs and
hashes, A's unchanged bytes, exact multipart fields/single source, allowed local
paths, and zero provider calls for missing, mutated or ambiguous sources.
The fixture does not establish live model quality; the bounded call above does
not establish Copilot-client compatibility. Those gates remain #25 and #21.
