import { randomUUID } from "node:crypto";
import { mkdir, open, realpath, rename, rmdir } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { ArtifactStore, readRegularFile, sha256, syncDirectories, type Artifact } from "./artifacts.js";

const idSchema = z.string().uuid();
const recordSchema = z.object({
  version: z.literal(1), id: idSchema, artifactId: idSchema,
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  state: z.enum(["started", "succeeded", "failed", "outcome_unknown"]),
  updatedAt: z.string().datetime(),
}).strict();
type OperationRecord = z.infer<typeof recordSchema>;
export type OperationStatus = OperationRecord & { artifact?: Artifact; recovered: boolean };

export class OperationError extends Error {
  constructor(readonly code: "busy" | "conflict" | "outcome_unknown" | "previous_failure", message: string) {
    super(message);
  }
}

export class OperationStore {
  private constructor(private readonly artifacts: ArtifactStore, private readonly root: string) {}

  static async create(artifacts: ArtifactStore): Promise<OperationStore> {
    const root = join(artifacts.root, ".operations");
    await mkdir(root, { recursive: true, mode: 0o700 });
    if (await realpath(root) !== root) throw new Error("Symlinked operation store.");
    return new OperationStore(artifacts, root);
  }

  private async read(id: string): Promise<OperationRecord | null> {
    idSchema.parse(id);
    try {
      const record = recordSchema.parse(JSON.parse((await readRegularFile(join(this.root, `${id}.json`), 16_384)).toString("utf8")));
      if (record.id !== id) throw new Error("Operation identity mismatch.");
      return record;
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
      throw error;
    }
  }

  private async write(record: OperationRecord): Promise<void> {
    const path = join(this.root, `${record.id}.json`);
    const temporary = `${path}.${randomUUID()}.pending`;
    const file = await open(temporary, "wx", 0o600);
    try {
      await file.writeFile(JSON.stringify(record) + "\n");
      await file.sync();
    } finally { await file.close(); }
    await rename(temporary, path);
    await syncDirectories(this.root);
  }

  async status(id: string): Promise<OperationStatus | null> {
    const record = await this.read(id);
    if (!record) return null;
    if (record.state === "failed") return { ...record, recovered: false };
    try {
      const artifact = await this.artifacts.get(record.artifactId);
      return { ...record, state: "succeeded", artifact, recovered: record.state !== "succeeded" };
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
      if (record.state === "succeeded") throw new Error("Completed operation artifact is missing.");
      return { ...record, state: "outcome_unknown", recovered: false };
    }
  }

  private async replay(record: OperationRecord, fingerprint: string): Promise<Artifact> {
    if (record.fingerprint !== fingerprint) throw new OperationError("conflict", "Operation ID already used with different arguments.");
    const status = await this.status(record.id);
    if (status?.artifact) return status.artifact;
    if (record.state === "failed") throw new OperationError("previous_failure", "This operation failed. Inspect its outcome before explicitly choosing a new ID.");
    throw new OperationError("outcome_unknown", "Upstream outcome unknown. Do not resubmit automatically; use get_operation to inspect.");
  }

  async run(id: string, request: Record<string, string>, submit: (artifactId: string) => Promise<Artifact>): Promise<Artifact> {
    idSchema.parse(id);
    const input = z.record(z.string(), z.string()).parse(request);
    const fingerprint = sha256(Buffer.from(JSON.stringify(Object.fromEntries(Object.entries(input).sort(([a], [b]) => a.localeCompare(b))))));
    const previous = await this.read(id);
    if (previous) return this.replay(previous, fingerprint);
    const lock = join(this.root, ".in-flight");
    try { await mkdir(lock, { mode: 0o700 }); } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "EEXIST") {
        throw new OperationError("busy", "Another operation is active or interrupted. Inspect stored status before removing a stale lock.");
      }
      throw error;
    }
    try {
      const rechecked = await this.read(id);
      if (rechecked) return this.replay(rechecked, fingerprint);
      const record: OperationRecord = {
        version: 1, id, artifactId: randomUUID(), fingerprint, state: "started", updatedAt: new Date().toISOString(),
      };
      await this.write(record);
      try {
        const result = await submit(record.artifactId);
        if (result.id !== record.artifactId) throw new Error("Unexpected artifact identity.");
        await this.artifacts.get(result.id);
        await this.write({ ...record, state: "succeeded", updatedAt: new Date().toISOString() });
        return result;
      } catch (error) {
        const knownFailure = error instanceof Error && "knownFailure" in error && error.knownFailure === true;
        await this.write({ ...record, state: knownFailure ? "failed" : "outcome_unknown", updatedAt: new Date().toISOString() });
        throw error;
      }
    } finally { await rmdir(lock); }
  }
}
