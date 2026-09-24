# Native image artifacts to editable slides

This standalone example uses PptxGenJS only in this directory, **not** in the MCP
runtime dependency graph. It produces three 16:9 slides: a hero, an editorial
visual and a reference-guided continuation. Titles/body text remain PowerPoint
text objects. Image proportions are preserved; sources are never rewritten.

From a development checkout:

```sh
npm ci
npm run build
npm ci --prefix examples/presentation
npm test --prefix examples/presentation
node examples/presentation/build.mjs \
  --hero /absolute/artifacts/A/image.png \
  --editorial /absolute/artifacts/C/image.png \
  --continuation /absolute/artifacts/B/image.png \
  --output /absolute/private/presentation.pptx
```

Use real returned artifact paths, not these placeholders. All three inputs must
be fully decodable native 1536x864 PNGs. The output is exclusive: an existing
file is not overwritten. Linux Libertine G and Linux Biolinum G are requested;
they were present in the tested LibreOffice renderer. Install those fonts or
choose an available serif/sans pair before rendering elsewhere. Fonts are not
embedded or distributed by this example; inspect the intended viewer for
substitution and changed wrapping.

In the proven local Copilot CLI workflow, ask Copilot to:

> Generate a cyan observatory hero with navy negative space on the left, using
> a fresh operation UUID. Inspect it. Explicitly edit that artifact into a coral
> sunrise continuation, retaining the composition and text space. Generate a
> separate coral/cyan editorial lens visual. Use the three full-resolution paths
> with `examples/presentation/build.mjs`; do not embed text in the artwork.

That prompt can submit **three billable requests**. Approve them deliberately
or use existing artifacts, as the automated example validation does. A reference
edit may change lighting/reflections and details outside the intended area;
neither this example nor the model promises pixel-identical style preservation.

For QA, render with LibreOffice to PDF in a private output directory, inspect
all pages, and extract editable text from the PPTX using MarkItDown or its slide
XML. LibreOffice, PDF rendering and text-extraction tools are development-only.
The runtime does not create or edit presentations and needs no separate planning
model; Copilot supplies the creative direction.
