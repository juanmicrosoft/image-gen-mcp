import { constants } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, open, realpath, rename } from "node:fs/promises";
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import sharp from "sharp";
import { z } from "zod";

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_PIXELS = 8_294_400;
const identifier = z.string().uuid();
const metadataSchema = z.object({
  deployment: z.string().min(1).max(128),
  model: z.literal("gpt-image-2.5-sunburst"),
  modelEvidence: z.enum(["configured", "observed"]),
  size: z.string().regex(/^\d+x\d+$/),
  quality: z.enum(["low", "medium", "high", "xhigh", "max", "auto"]),
  sourceArtifactId: identifier.optional(),
  sourceHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  requestId: z.string().regex(/^[\w.-]{1,128}$/).optional(),
}).strict();
export type ArtifactMetadata = z.infer<typeof metadataSchema>;
const manifestSchema = z.object({
  version: z.literal(1),
  id: identifier,
  createdAt: z.string().datetime(),
  mimeType: z.literal("image/png"),
  width: z.number().int().positive().max(3840),
  height: z.number().int().positive().max(3840),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  metadata: metadataSchema,
}).strict();
export type Artifact = z.infer<typeof manifestSchema> & { path: string };
export const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

export async function syncDirectories(directory: string): Promise<void> {
  for (;;) {
    const handle = await open(directory, "r");
    try { await handle.sync(); } finally { await handle.close(); }
    const parent = dirname(directory);
    if (parent === directory) return;
    directory = parent;
  }
}

export async function validatePng(bytes: Buffer): Promise<{ width: number; height: number }> {
  if (bytes.length > MAX_IMAGE_BYTES || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    throw new Error("Expected a bounded PNG image.");
  }
  let position = 8;
  let ended = false;
  while (position + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(position);
    if (length > bytes.length - position - 12) throw new Error("Truncated PNG chunk.");
    const type = bytes.toString("ascii", position + 4, position + 8);
    if (["acTL", "fcTL", "fdAT"].includes(type)) throw new Error("Animated PNG is unsupported.");
    position += length + 12;
    if (type === "IEND") {
      if (length !== 0 || position !== bytes.length) throw new Error("Invalid PNG ending.");
      ended = true;
      break;
    }
  }
  if (!ended) throw new Error("Missing PNG ending.");
  const image = sharp(bytes, { limitInputPixels: MAX_PIXELS, failOn: "warning" });
  const metadata = await image.metadata();
  if (metadata.format !== "png" || !metadata.width || !metadata.height ||
      metadata.width > 3840 || metadata.height > 3840 || (metadata.pages ?? 1) !== 1 ||
      (metadata.orientation !== undefined && metadata.orientation !== 1)) {
    throw new Error("Unsupported image dimensions, animation or orientation.");
  }
  await image.raw().toBuffer();
  return { width: metadata.width, height: metadata.height };
}

export async function readLocalImage(path: string, roots: readonly string[]): Promise<Buffer> {
  if (!isAbsolute(path)) throw new Error("Image input must be an absolute path.");
  if (extname(path).toLowerCase() !== ".png") throw new Error("Image filename must use .png.");
  const canonical = await realpath(path);
  if (canonical !== resolve(path)) throw new Error("Symlinked image paths are not allowed.");
  const allowed = await Promise.all(roots.map((root) => realpath(root)));
  if (!allowed.some((root) => {
    const rel = relative(root, canonical);
    return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
  })) throw new Error("Image input is outside approved roots.");
  const result = await readRegularFile(canonical, MAX_IMAGE_BYTES);
  await validatePng(result);
  return result;
}

export async function readRegularFile(path: string, limit: number): Promise<Buffer> {
  const entry = await lstat(path);
  if (!entry.isFile() || entry.size > limit) throw new Error("Input is not a bounded regular file.");
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = await file.stat();
    if (!before.isFile() || before.size > limit) throw new Error("Input is not a bounded regular file.");
    const buffer = Buffer.alloc(limit + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await file.read(buffer, offset, buffer.length - offset, offset);
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    if (offset > limit) throw new Error("Input is too large.");
    const after = await file.stat();
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) throw new Error("Input changed while reading.");
    return buffer.subarray(0, offset);
  } finally {
    await file.close();
  }
}

async function writeDurable(path: string, value: string | Buffer): Promise<void> {
  const file = await open(path, "wx", 0o600);
  try { await file.writeFile(value); await file.sync(); } finally { await file.close(); }
}

export class ArtifactStore {
  private constructor(
    readonly root: string,
    private readonly persist: typeof writeDurable,
  ) {}

  static async create(root: string, persist = writeDurable): Promise<ArtifactStore> {
    if (!isAbsolute(root)) throw new Error("Output root must be absolute.");
    await mkdir(root, { recursive: true, mode: 0o700 });
    if ((await lstat(root)).isSymbolicLink()) throw new Error("Output root cannot be a symlink.");
    return new ArtifactStore(await realpath(root), persist);
  }

  async save(bytes: Buffer, metadata: ArtifactMetadata, id = randomUUID()): Promise<Artifact> {
    identifier.parse(id);
    const validated = metadataSchema.parse(metadata);
    const { width, height } = await validatePng(bytes);
    if (validated.size !== `${width}x${height}`) throw new Error("Provider dimensions do not match requested size.");
    const manifest = manifestSchema.parse({
      version: 1, id, createdAt: new Date().toISOString(), mimeType: "image/png",
      width, height, sha256: sha256(bytes), metadata: validated,
    });
    // The claim is never reused, even after a failed save; it protects immutable IDs.
    await mkdir(join(this.root, `.claim-${id}`), { mode: 0o700 });
    const pending = join(this.root, `.pending-${id}`);
    await mkdir(pending, { mode: 0o700 });
    await this.persist(join(pending, "image.png"), bytes);
    await this.persist(join(pending, "manifest.json"), JSON.stringify(manifest) + "\n");
    await syncDirectories(pending);
    await rename(pending, join(this.root, id));
    await syncDirectories(this.root);
    return { ...manifest, path: join(this.root, id, "image.png") };
  }

  async get(id: string): Promise<Artifact> {
    identifier.parse(id);
    const folder = join(this.root, id);
    if (await realpath(folder) !== folder) throw new Error("Symlinked artifact directory.");
    const manifestPath = join(folder, "manifest.json");
    const manifest = manifestSchema.parse(JSON.parse((await readRegularFile(manifestPath, 16_384)).toString("utf8")));
    if (manifest.id !== id) throw new Error("Artifact identity mismatch.");
    const path = join(folder, "image.png");
    const bytes = await readLocalImage(path, [this.root]);
    const dimensions = await validatePng(bytes);
    if (sha256(bytes) !== manifest.sha256 || dimensions.width !== manifest.width || dimensions.height !== manifest.height) {
      throw new Error("Artifact content changed.");
    }
    return { ...manifest, path };
  }
}
