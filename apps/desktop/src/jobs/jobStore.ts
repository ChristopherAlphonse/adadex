import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { newJob, type WorkflowDefinition, type WorkflowJob } from "@adadex/core";
import { type AuditRow, GENESIS, type LogDb, lineHash, openLogDb, sha256 } from "../logs/logDb";
import { redact } from "../logs/redact";

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

export { GENESIS };

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

export interface JobStoreOptions {
  /** The machine's log database. Without one, a private in-memory database is used (tests). */
  readonly db?: LogDb;
  /** Keeps two projects' jobs apart in one database. */
  readonly project?: string;
}

const toStored = (r: AuditRow): StoredAudit => ({
  actor: r.actor as StoredAudit["actor"],
  action: r.action,
  jobId: r.jobId,
  detail: r.detail,
  ...(r.role === undefined ? {} : { role: r.role }),
  ...(r.runId === undefined ? {} : { runId: r.runId }),
  ...(r.data === undefined ? {} : { data: r.data }),
  ts: r.ts,
  state: r.state,
  prev: r.prev,
  hash: r.hash,
});

/**
 * Jobs live under `<root>/jobs/<id>/job.json`, written through a temp file so a crash never leaves half a file.
 * The audit chain lives in the machine's SQLite log database, not in a file an agent could reach.
 */
export const createJobStore = (
  root: string,
  now: () => Date = () => new Date(),
  options: JobStoreOptions = {},
): JobStore => {
  const logDb = options.db ?? openLogDb(":memory:");
  const project = options.project ?? "default";
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

  const audit = async (entry: AuditEntry): Promise<void> => {
    jobDir(entry.jobId);
    const record = await readFile(file(entry.jobId), "utf8").catch(() => "");
    logDb.appendAudit(project, {
      ts: now().toISOString(),
      actor: entry.actor,
      action: entry.action,
      jobId: entry.jobId,
      detail: redact(entry.detail),
      role: entry.role,
      runId: entry.runId,
      data: entry.data,
      state: sha256(record),
    });
  };

  const verify = async (id: string): Promise<VerifyResult> => {
    let rows: readonly AuditRow[];
    try {
      rows = logDb.auditRows(project, id);
    } catch {
      return { ok: false, reason: "the audit log cannot be read" };
    }
    let prev = GENESIS;
    for (const [i, row] of rows.entries()) {
      if (row.prev !== prev)
        return { ok: false, reason: `audit line ${i + 1} does not follow the line before it` };
      if (row.hash !== lineHash(prev, row))
        return { ok: false, reason: `audit line ${i + 1} was changed` };
      prev = row.hash;
    }
    const record = await readFile(file(id), "utf8").catch(() => null);
    const last = rows.at(-1);
    if (record !== null && last && last.state !== sha256(record)) {
      return { ok: false, reason: "the job record was changed outside the app" };
    }
    return { ok: true, entries: rows.length };
  };

  const readAudit = async (id: string): Promise<readonly StoredAudit[]> => {
    const v = await verify(id);
    if (!v.ok) throw new Error(v.reason);
    return logDb.auditRows(project, id).map(toStored);
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
