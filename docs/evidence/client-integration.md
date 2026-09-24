# Client and presentation integration — epic #5

2026-09-24. **This epic remains open** because authenticated VS Code acceptance
in #21 is not established.

| Child | Dedicated PR | Evidence |
| --- | --- | --- |
| #21 real Copilot clients | [#48](https://github.com/juanmicrosoft/image-gen-mcp/pull/48), partial merged | [Actual CLI workflow/deadlines](copilot-cli.md), [client setup and unverified VS Code configuration](../clients.md) |
| #22 editable presentation | [#53](https://github.com/juanmicrosoft/image-gen-mcp/pull/53), closed | [Actual CLI-built, rendered and independently inspected deck](presentation.md) |

Copilot CLI 1.0.79 on macOS exercised generation, bounded image inspection,
explicit-source editing, full-resolution local access and preview-off replay.
The structured operation/artifact IDs and decoded image hashes are the evidence;
client prose claiming a perfectly isolated sky change is not.

The presentation consumes the evaluated full-resolution artifacts in three
16:9 slides with editable OOXML text. The rendered deck underwent an independent
fix-and-rerender cycle for font substitution and footer clearance. Embedded
images match source hashes. Fonts are not embedded; this does not prove all
PowerPoint/viewer platforms render identically.

VS Code was installed but the observed extension list had no Copilot extension;
there is no authenticated VS Code discovery/inspection/editing/deadline proof.
Do not infer it from the SDK or CLI, and do not change the user's global
extensions/authentication to manufacture an acceptance result.

The fresh installed-package edit also remains unknown under #26; it is separate
from the successful source-build client workflow. Completing #21 requires an
authorized authenticated VS Code session and the original end-to-end checks;
both that child and this epic remain open.
