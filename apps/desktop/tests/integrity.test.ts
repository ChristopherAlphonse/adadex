import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { factoryBuildPreset, type WorkflowJob } from "@adadex/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { attestedGate } from "../src/jobs/attestedGate";
import { createJobExecutor } from "../src/jobs/jobActions";
import { createJobStore, GENESIS } from "../src/jobs/jobStore";
import { writeGate } from "./helpers/attest";

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "adadex-integrity-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const setup = async () => {
  const store = createJobStore(root, () => new Date("2026-11-19T00:00:00.000Z"));
  const job = await store.create(factoryBuildPreset, "j1", "t", 3);
  return { store, job, log: join(store.jobDir("j1"), "audit.log") };
};
const lines = async (path: string) => (await readFile(path, "utf8")).split("\n").filter(Boolean);

describe("tamper-evident audit log", () => {
  it("chains every line to the one before it, starting from a fixed beginning", async () => {
    const { store, log } = await setup();
    await store.audit({
      actor: "agent",
      action: "advance",
      jobId: "j1",
      detail: "shape -> spec",
      role: "shaper",
      runId: "r1",
    });
    await store.audit({ actor: "human", action: "approve-spec", jobId: "j1", detail: "abc" });
    const parsed = (await lines(log)).map((l) => JSON.parse(l));
    expect(parsed[0].prev).toBe(GENESIS);
    expect(parsed[1].prev).toBe(parsed[0].hash);
    expect(parsed[2].prev).toBe(parsed[1].hash);
    expect(parsed[1]).toMatchObject({ role: "shaper", runId: "r1" });
    expect(await store.verify("j1")).toEqual({ ok: true, entries: 3 });
  });

  it("detects an edited line, a deleted line, a reordered pair and a forged extra line", async () => {
    for (const tamper of [
      (l: string[]) => [l[0] ?? "", (l[1] ?? "").replace("advance", "approve"), l[2] ?? ""],
      (l: string[]) => [l[0] ?? "", l[2] ?? ""],
      (l: string[]) => [l[0] ?? "", l[2] ?? "", l[1] ?? ""],
      (l: string[]) => [
        ...l,
        JSON.stringify({
          ts: "x",
          actor: "human",
          action: "commit",
          jobId: "j1",
          detail: "sha",
          state: "x",
          prev: GENESIS,
          hash: "f".repeat(64),
        }),
      ],
    ]) {
      const { store, log } = await setup();
      await store.audit({ actor: "agent", action: "advance", jobId: "j1", detail: "a" });
      await store.audit({ actor: "agent", action: "advance", jobId: "j1", detail: "b" });
      await writeFile(log, `${tamper(await lines(log)).join("\n")}\n`);
      expect((await store.verify("j1")).ok).toBe(false);
      await rm(join(root, "jobs"), { recursive: true, force: true });
    }
  });

  it("detects a job record that was edited outside the app", async () => {
    const { store, job } = await setup();
    await writeFile(
      join(store.jobDir("j1"), "job.json"),
      `${JSON.stringify({ ...job, stage: "ship" })}\n`,
    );
    expect(await store.verify("j1")).toEqual({
      ok: false,
      reason: "the job record was changed outside the app",
    });
  });

  it("accepts a change the app made and audited", async () => {
    const { store, job } = await setup();
    await store.save({ ...job, round: 2 });
    await store.audit({ actor: "system", action: "round", jobId: "j1", detail: "2" });
    expect((await store.verify("j1")).ok).toBe(true);
  });

  it("keeps the chain valid when many audits are written at the same time", async () => {
    const { store } = await setup();
    await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        store.audit({ actor: "agent", action: "note", jobId: "j1", detail: String(i) }),
      ),
    );
    expect(await store.verify("j1")).toEqual({ ok: true, entries: 26 });
  });

  it("refuses to read an audit log whose chain is broken", async () => {
    const { store, log } = await setup();
    await writeFile(log, "not json\n");
    await expect(store.readAudit("j1")).rejects.toThrow();
  });
});

describe("a gate result the audit log does not vouch for counts for nothing", () => {
  const gateAt = async (store: ReturnType<typeof createJobStore>, job: WorkflowJob) => {
    const saved = { ...job, stage: "gate", round: 1 };
    await store.save(saved);
    await store.audit({ actor: "system", action: "sync", jobId: "j1", detail: "" });
    return saved;
  };

  it("believes a gate the app recorded", async () => {
    const { store, job } = await setup();
    const saved = await gateAt(store, job);
    await writeGate(store, "j1", 1, "PASS", "tree-1");
    expect(await attestedGate(store, saved)).toEqual({ gate: "PASS", tree: "tree-1" });
  });

  it("ignores a checks.md an agent wrote, and a verdict edited from FAIL to PASS", async () => {
    const { store, job } = await setup();
    const saved = await gateAt(store, job);
    await mkdir(join(store.jobDir("j1"), "round-1"), { recursive: true });
    await writeFile(join(store.jobDir("j1"), "round-1", "checks.md"), "GATE: PASS\nTREE: forged\n");
    expect(await attestedGate(store, saved)).toBeNull();
    await writeGate(store, "j1", 1, "FAIL", "tree-1");
    await writeFile(join(store.jobDir("j1"), "round-1", "checks.md"), "GATE: PASS\nTREE: tree-1\n");
    expect(await attestedGate(store, saved)).toBeNull();
  });

  it("ignores a tree edited to match a later change, and a result from another round", async () => {
    const { store, job } = await setup();
    const saved = await gateAt(store, job);
    await writeGate(store, "j1", 1, "PASS", "tree-1");
    await writeFile(join(store.jobDir("j1"), "round-1", "checks.md"), "GATE: PASS\nTREE: tree-2\n");
    expect(await attestedGate(store, saved)).toBeNull();
    await writeGate(store, "j1", 1, "PASS", "tree-1");
    expect(await attestedGate(store, { ...saved, round: 2 })).toBeNull();
  });

  it("ignores everything once the audit chain is broken", async () => {
    const { store, job, log } = await setup();
    const saved = await gateAt(store, job);
    await writeGate(store, "j1", 1, "PASS", "tree-1");
    await writeFile(log, `${(await lines(log)).slice(1).join("\n")}\n`);
    expect(await attestedGate(store, saved)).toBeNull();
  });

  it("so a forged gate cannot move a job forward", async () => {
    const { store, job } = await setup();
    await gateAt(store, job);
    const executor = createJobExecutor({
      store,
      workflows: { factory: factoryBuildPreset },
      runEffect: async () => {},
      actor: () => "agent",
    });
    await mkdir(join(store.jobDir("j1"), "round-1"), { recursive: true });
    await writeFile(join(store.jobDir("j1"), "round-1", "checks.md"), "GATE: PASS\nTREE: forged\n");
    await expect(executor.execute("job.advance", { id: "j1", to: "review" })).rejects.toThrow(
      "run `job gate` first",
    );
  });
});
