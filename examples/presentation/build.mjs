import pptxgen from "pptxgenjs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute } from "node:path";
import { parseArgs } from "node:util";
import { MAX_IMAGE_BYTES, readRegularFile, validatePng } from "../../dist/artifacts.js";

const { values } = parseArgs({ options: {
  hero: { type: "string" }, editorial: { type: "string" },
  continuation: { type: "string" }, output: { type: "string" },
} });
try {
  for (const name of ["hero", "editorial", "continuation", "output"]) {
    if (!values[name] || !isAbsolute(values[name])) throw new Error(`Provide an absolute --${name} path.`);
  }
  const images = {};
  for (const name of ["hero", "editorial", "continuation"]) {
    const bytes = await readRegularFile(values[name], MAX_IMAGE_BYTES);
    const dimensions = await validatePng(bytes);
    if (dimensions.width !== 1536 || dimensions.height !== 864) throw new Error("This example requires native 1536x864 PNGs.");
    images[name] = `image/png;base64,${bytes.toString("base64")}`;
  }
  const pptx = new pptxgen();
  const width = 7.5 * 16 / 9, height = 7.5;
  pptx.defineLayout({ name: "NATIVE_WIDE", width, height });
  pptx.layout = "NATIVE_WIDE";
  pptx.author = "image-gen-mcp contributors";
  pptx.subject = "Native Azure image artifacts with editable slide text";
  pptx.title = "Make room for wonder";
  pptx.lang = "en-US";
  const headingFont = "Linux Libertine G", bodyFont = "Linux Biolinum G";
  pptx.theme = { headFontFace: headingFont, bodyFontFace: bodyFont, lang: "en-US" };
  const text = (slide, value, x, y, w, h, options = {}) => slide.addText(value, {
    x, y, w, h, margin: 0, breakLine: false, fontFace: bodyFont,
    fontSize: 16, color: "F4F1E9", valign: "mid", ...options,
  });
  const fullImage = (slide, data, altText) => slide.addImage({ data, x: 0, y: 0, w: width, h: height, altText });
  const darkCopyArea = (slide) => slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 4.8, h: height, line: { transparency: 100 },
    fill: { color: "071A2D", transparency: 12 },
  });

  let slide = pptx.addSlide();
  fullImage(slide, images.hero, "Cyan observatory and teal mountains with navy negative space");
  darkCopyArea(slide);
  text(slide, "IMAGE-GEN-MCP / FIELD NOTES", 0.65, 0.65, 4.05, 0.35, { fontSize: 11, charSpacing: 1.7, color: "77DCE8" });
  text(slide, "Make room\nfor wonder.", 0.65, 1.55, 3.95, 2.0, { fontFace: headingFont, fontSize: 43 });
  text(slide, "Create the image.\nKeep the story editable.", 0.65, 4.2, 3.95, 0.8, { fontSize: 18 });
  text(slide, "Native 16:9 art / editable typography", 0.65, 6.6, 4.05, 0.35, { fontSize: 12, color: "CCD6DD" });

  slide = pptx.addSlide();
  slide.background = { color: "F4F1E9" };
  text(slide, "THE CREATIVE BRIEF", 0.65, 0.65, 3.7, 0.35, { fontSize: 11, charSpacing: 1.8, color: "236B77" });
  text(slide, "Start with\na precise brief.", 0.65, 1.35, 3.7, 1.7, { fontFace: headingFont, fontSize: 34, color: "071A2D" });
  text(slide, "Subject. Space. Palette.", 0.65, 3.55, 3.7, 0.8, { fontSize: 19, bold: true, color: "071A2D" });
  text(slide, "Keep the artwork visual.\nKeep the words editable.", 0.65, 4.55, 3.7, 0.8, { fontSize: 16, color: "344C5E" });
  slide.addImage({ data: images.editorial, x: 4.8, y: 1.15, w: 7.85, h: 7.85 * 9 / 16, altText: "Coral and cyan editorial optical forms" });
  text(slide, "1536 x 864 PNG / native proportions, no stretching", 4.8, 5.95, 7.85, 0.35, { fontSize: 12, color: "344C5E" });
  text(slide, "Editorial illustration, not a physical optical schematic.", 4.8, 6.4, 7.85, 0.35, { fontSize: 11, color: "344C5E" });

  slide = pptx.addSlide();
  fullImage(slide, images.continuation, "Reference-guided coral sunrise continuation of the observatory scene");
  darkCopyArea(slide);
  text(slide, "REFERENCE-LED EDITING", 0.65, 0.65, 4.05, 0.35, { fontSize: 11, charSpacing: 1.7, color: "FFA58B" });
  text(slide, "Same story.\nA new light.", 0.65, 1.55, 3.95, 2.0, { fontFace: headingFont, fontSize: 43 });
  text(slide, "Choose the source explicitly.\nDescribe what should change.", 0.65, 4.2, 3.95, 0.8, { fontSize: 16 });
  text(slide, "Source-aware, not pixel-identical.", 0.65, 6.6, 4.05, 0.35, { fontSize: 12, color: "CCD6DD" });
  await mkdir(dirname(values.output), { recursive: true, mode: 0o700 });
  await writeFile(values.output, await pptx.write({ outputType: "nodebuffer" }), { flag: "wx", mode: 0o600 });
  process.stdout.write(`Created three editable slides: ${values.output}\n`);
} catch (error) {
  process.stderr.write(`Presentation example failed: ${error.message}\n`);
  process.exitCode = 1;
}
