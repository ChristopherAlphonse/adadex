import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { WorkflowJob } from "@adadex/core";

import type { JobStore } from "./jobStore";
import { parseKv } from "./kv";

export interface AttestedGate {
  readonly gate: string;
  readonly tree: string;
}

/**
 * The gate result for this round, but only if the audit log vouches for it. An agent can write any file in its
 * job folder it is allowed to, so a `checks.md` is believed only when the app's own audit line for the same
 * round says the same verdict and tree. A forged or edited file gives nothing, and the gate counts as not run.
 */
export const attestedGate = async (
  store: JobStore,
  job: WorkflowJob,
): Promise<AttestedGate | null> => {
  const text = await readFile(
    join(store.jobDir(job.id), `round-${job.round}`, "checks.md"),
    "utf8",
  ).catch(() => null);
  if (text === null) return null;
  const file = parseKv(text);
  let entries: Awaited<ReturnType<JobStore["readAudit"]>>;
  try {
    entries = await store.readAudit(job.id);
  } catch {
    return null;
  }
  const entry = [...entries]
    .reverse()
    .find((e) => e.action === "gate" && e.data?.round === job.round);
  if (!entry || entry.data?.gate !== file.GATE || entry.data?.tree !== file.TREE) return null;
  return { gate: String(file.GATE), tree: String(file.TREE) };
};
