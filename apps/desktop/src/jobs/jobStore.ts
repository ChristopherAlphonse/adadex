import { appendFile, mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { newJob, type WorkflowDefinition, type WorkflowJob } from "@adadex/core";

const JOB_ID = /^[a-z0-9][a-z0-9-]*$/;

export interface AuditEntry {
  readonly actor: "human" | "agent" | "system";
  readonly action: string;
  readonly jobId: string;
  readonly detail: string;
}

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
  audit(entry: AuditEntry): Promise<void>;
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

  const audit = async (entry: AuditEntry): Promise<void> => {
    await mkdir(jobDir(entry.jobId), { recursive: true });
    const line = JSON.stringify({ ts: now().toISOString(), ...entry });
    await appendFile(join(jobDir(entry.jobId), "audit.log"), `${line}\n`);
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
