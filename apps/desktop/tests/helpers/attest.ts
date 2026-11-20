import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { JobStore } from "../../src/jobs/jobStore";

/** Write a gate result the way a real gate run does: the file, and the audit line that vouches for it. */
export const writeGate = async (
  store: JobStore,
  jobId: string,
  round: number,
  gate: "PASS" | "FAIL",
  tree = "t1",
): Promise<void> => {
  const dir = join(store.jobDir(jobId), `round-${round}`);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "checks.md"), `GATE: ${gate}\nTREE: ${tree}\n`);
  await store.audit({
    actor: "system",
    action: "gate",
    jobId,
    detail: gate,
    data: { round, gate, tree },
  });
};
