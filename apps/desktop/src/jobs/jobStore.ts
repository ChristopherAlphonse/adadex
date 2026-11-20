import { createHash } from "node:crypto";
import { appendFile, mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { newJob, type WorkflowDefinition, type WorkflowJob } from "@adadex/core";

const JOB_ID = /^[a-z0-9][a-z0-9-]*$/;

export interface AuditEntry {
  readonly actor: "human" | "agent" | "system";
  readonly action: string;
  readonly jobId: string;
  readonly detail: string;
  /** The role and run an agent was working in, when an agent did it. */
  readonly role?: string;
  readonly runId?: string;
  /** Facts a later check needs, such as the gate verdict and tree. */
  readonly data?: Readonly<Record<string, string | number>>;
}

/** An audit line as stored: the entry, when, what the job record looked like, and the chain. */
export interface StoredAudit extends AuditEntry {
  readonly ts: string;
  /** Hash of job.json when this line was written. */
  readonly state: string;
  readonly prev: string;
  readonly hash: string;
}

export type VerifyResult =
  | { readonly ok: true; readonly entries: number }
  | { readonly ok: false; readonly reason: string };

export const GENESIS = "0".repeat(64);
const sha = (text: string): string => createHash("sha256").update(text).digest("hex");
const lineHash = (prev: string, body: object): string => sha(prev + JSON.stringify(body));

export interface JobStore {
  readonly jobDir: (id: string) => string;
  create(
    def: WorkflowDefinition,
    id: string,
    title: string,
    roundLimit: number,
  ): Promise<WorkflowJob>;
  load(id: string): Promise<WorkflowJob>;
  save(job: WorkflowJob): Promise<void>;
  list(): Promise<readonly WorkflowJob[]>;
  /** Append to the audit log. Each line carries the hash of the one before it and of the job record. */
  audit(entry: AuditEntry): Promise<void>;
  /** Check the whole chain, and that the job record is what the last line says it was. */
  verify(id: string): Promise<VerifyResult>;
  /** The audit lines, only if the chain is intact. */
  readAudit(id: string): Promise<readonly StoredAudit[]>;
}

const exists = async (path: string): Promise<boolean> =>
  readFile(path).then(
    () => true,
    () => false,
  );

/** Jobs live under `<root>/jobs/<id>/job.json`, written through a temp file so a crash never leaves half a file. */
export const createJobStore = (root: string, now: () => Date = () => new Date()): JobStore => {
  const jobDir = (id: string): string => {
    if (!JOB_ID.test(id)) throw new Error(`bad job id ${id}`);
    return join(root, "jobs", id);
  };
  const file = (id: string): string => join(jobDir(id), "job.json");

  const save = async (job: WorkflowJob): Promise<void> => {
    const tmp = `${file(job.id)}.${process.pid}.tmp`;
    await writeFile(tmp, `${JSON.stringify(job, null, 2)}\n`);
    await rename(tmp, file(job.id));
  };

  const chains = new Map<string, Promise<unknown>>();
  const readLines = async (id: string): Promise<StoredAudit[]> => {
    const text = await readFile(join(jobDir(id), "audit.log"), "utf8").catch(() => "");
    return text
      .split("\n")
      .filter((l) => l !== "")
      .map((l) => JSON.parse(l) as StoredAudit);
  };

  const audit = (entry: AuditEntry): Promise<void> => {
    // One writer per job at a time, so two calls cannot both extend the same line.
    const run = (chains.get(entry.jobId) ?? Promise.resolve()).then(async () => {
      await mkdir(jobDir(entry.jobId), { recursive: true });
      const lines = await readLines(entry.jobId).catch(() => [] as StoredAudit[]);
      const prev = lines.at(-1)?.hash ?? GENESIS;
      const record = await readFile(file(entry.jobId), "utf8").catch(() => "");
      const body = { ts: now().toISOString(), ...entry, state: sha(record) };
      await appendFile(
        join(jobDir(entry.jobId), "audit.log"),
        `${JSON.stringify({ ...body, prev, hash: lineHash(prev, body) })}\n`,
      );
    });
    chains.set(
      entry.jobId,
      run.catch(() => undefined),
    );
    return run;
  };

  const verify = async (id: string): Promise<VerifyResult> => {
    let lines: StoredAudit[];
    try {
      lines = await readLines(id);
    } catch {
      return { ok: false, reason: "the audit log cannot be read" };
    }
    let prev = GENESIS;
    for (const [i, line] of lines.entries()) {
      const { prev: p, hash, ...body } = line;
      if (p !== prev)
        return { ok: false, reason: `audit line ${i + 1} does not follow the line before it` };
      if (hash !== lineHash(prev, body))
        return { ok: false, reason: `audit line ${i + 1} was changed` };
      prev = hash;
    }
    const record = await readFile(file(id), "utf8").catch(() => null);
    const last = lines.at(-1);
    if (record !== null && last && last.state !== sha(record)) {
      return { ok: false, reason: "the job record was changed outside the app" };
    }
    return { ok: true, entries: lines.length };
  };

  const readAudit = async (id: string): Promise<readonly StoredAudit[]> => {
    const v = await verify(id);
    if (!v.ok) throw new Error(v.reason);
    return readLines(id);
  };

  const load = async (id: string): Promise<WorkflowJob> => {
    try {
      return JSON.parse(await readFile(file(id), "utf8")) as WorkflowJob;
    } catch {
      throw new Error(`no job ${id}`);
    }
  };

  return {
    jobDir,
    save,
    audit,
    verify,
    readAudit,
    load,
    async create(def, id, title, roundLimit) {
      if (await exists(file(id))) throw new Error(`${id} exists`);
      await mkdir(jobDir(id), { recursive: true });
      const job = newJob(def, id, title, { roundLimit });
      await save(job);
      await audit({ actor: "system", action: "create", jobId: id, detail: title });
      return job;
    },
    async list() {
      const ids = await readdir(join(root, "jobs")).catch(() => [] as string[]);
      const jobs = await Promise.all(
        ids.filter((i) => JOB_ID.test(i)).map((i) => load(i).catch(() => null)),
      );
      return jobs.filter((j): j is WorkflowJob => j !== null);
    },
  };
};
