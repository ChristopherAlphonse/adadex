import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { JobFacts, WorkflowJob } from "@adadex/core";
import { attestedGate } from "./attestedGate";
import type { JobStore } from "./jobStore";
import { parseKv } from "./kv";

const read = async (path: string): Promise<string | null> =>
  readFile(path, "utf8").catch(() => null);
const names = async (dir: string): Promise<string[]> => readdir(dir).catch(() => [] as string[]);

/** Read what the engine needs to judge a move: the stage documents, the gate result, the reviews, and the hash of anything approvable. */
export const readFacts = async (store: JobStore, job: WorkflowJob): Promise<JobFacts> => {
  const jobDir = store.jobDir(job.id);
  const docs: Record<string, Record<string, string>> = {};
  for (const name of await names(jobDir)) {
    if (!name.endsWith(".md")) continue;
    docs[name] = parseKv((await read(join(jobDir, name))) ?? "");
  }

  const roundDir = join(jobDir, `round-${job.round}`);
  const gate = (await attestedGate(store, job))?.gate;

  const reviews: Record<string, string | undefined> = {};
  for (const reviewer of job.reviewers) {
    const text = await read(join(roundDir, `review-${reviewer}.md`));
    reviews[reviewer] = text === null ? undefined : parseKv(text).VERDICT;
  }

  const spec = await read(join(jobDir, "spec.md"));
  const hashes = spec === null ? {} : { spec: createHash("sha256").update(spec).digest("hex") };
  return { docs, reviews, hashes, ...(gate === undefined ? {} : { gate }) };
};
