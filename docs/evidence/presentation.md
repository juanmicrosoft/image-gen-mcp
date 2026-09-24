# Editable presentation evidence

Issue #22, observed 2026-09-24 on macOS arm64 with Node 22.22.2,
PptxGenJS 4.0.1, LibreOffice 26.8.0.3 and the three
[evaluated runtime PNGs](visual-evaluation.md).
The example dependencies are isolated under `examples/presentation`; the runtime
package does not depend on PptxGenJS, LibreOffice or Python rendering tools.

The actual Copilot CLI 1.0.79 (isolated profile, `--no-auto-update`, no image MCP
enabled) executed `node examples/presentation/build.mjs` using A's hero path,
C's editorial path and B's explicit-reference continuation path. One shell tool
completed successfully and produced three slides. Existing full-resolution
artifacts were reused; no new Azure image request was made.

## Render, inspect, fix, rerender

1. Built `draft.pptx` and rendered it to PDF with LibreOffice using an isolated
   `UserInstallation` profile. PyMuPDF 1.26.5 rendered all three pages to PNG.
2. Independent visual/OOXML/PDF-font review found a P2 font substitution:
   requested Georgia/Trebuchet MS rendered as Linux Libertine G, with a different
   bold fallback. It also found P3 small 10-point footers with 0.45-inch frame
   clearance on slides 1 and 3.
3. Changed theme and every explicit run to the locally available Linux Libertine
   G / Linux Biolinum G pair. Increased those footers to 12 points and moved
   their frames to provide 0.55-inch bottom clearance.
4. Copilot produced `final.pptx`; all three pages were rerendered. Actual PDF
   span fonts were only `LinuxLibertineG`, `LinuxBiolinumG` and the intended bold
   `LinuxBiolinumGB`. Editable OOXML text extraction found the expected titles,
   body text and captions on all three slides, with no placeholders.

The rendered QA covers crop, proportions, text overflow/overlap, contrast and
composition. Images retain native 16:9 proportions. The editorial form's
right-edge crop is in the original image, not introduced by the slide layout.
The full-resolution original PNGs, not MCP thumbnails, are embedded.
All three embedded PNG hashes match the original artifacts. A later bounded
regular-file reader change produced identical slide XML and embedded image
bytes to the rendered final deck. The isolated example regression test verifies
exclusive output, unchanged existing decks and invalid/missing/oversized input
rejection without creating an output.

The deck, render outputs and private client log remain in ignored
`.local/presentation/`. No local user paths or image payloads are committed.
Fonts are not embedded/distributed; other viewers may substitute them and
require another rendering pass. Text extraction used direct OOXML validation;
it proves editable text objects, not merely visible text baked into images.

Reproduce using [the standalone example](../../examples/presentation/README.md).
This proves the local CLI workflow, not unverified VS Code or remote filesystem
behavior. Reference continuity is probabilistic; lighting and reflections also
changed in B. The example is not a general slide editor or an extra planning
model.
