import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { factoryBuildPreset, type WorkflowJob } from "@adadex/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { attestedGate } from "../src/jobs/attestedGate";
import { createJobExecutor } from "../src/jobs/jobActions";
import { createJobStore, GENESIS } from "../src/jobs/jobStore";
import { openLogDb } from "../src/logs/logDb";
import { writeGate } from "./helpers/attest";

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "adadex-integrity-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const setup = async () => {
  const path = join(root, "logs", "adadex.db");
  const logDb = openLogDb(path);
  const store = createJobStore(join(root, "state"), () => new Date("2026-11-19T00:00:00.000Z"), {
    db: logDb,
    project: "p",
  });
  const job = await store.create(factoryBuildPreset, "j1", "t", 3);
  const attacker = () => {
    const db = new DatabaseSync(path);
    db.exec("DROP TRIGGER audit_no_update; DROP TRIGGER audit_no_delete;");
    return db;
  };
  return { store, job, logDb, path, attacker };
};

describe("tamper-evident audit log in the local database", () => {
  it("chains every line to the one before it, starting from a fixed beginning", async () => {
    const { store, logDb } = await setup();
    await store.audit({
      actor: "agent",
      action: "advance",
      jobId: "j1",
      detail: "shape -> spec",
      role: "shaper",
      runId: "r1",
    });
    await store.audit({ actor: "human", action: "approve-spec", jobId: "j1", detail: "abc" });
    const rows = logDb.auditRows("p", "j1");
    expect(rows[0]?.prev).toBe(GENESIS);
    expect(rows[1]?.prev).toBe(rows[0]?.hash);
    expect(rows[2]?.prev).toBe(rows[1]?.hash);
    expect(rows[1]).toMatchObject({ role: "shaper", runId: "r1" });
    expect(await store.verify("j1")).toEqual({ ok: true, entries: 3 });
  });

  it("refuses to change or delete a line, even for a plain sql statement", async () => {
    const { store, logDb } = await setup();
    await store.audit({ actor: "agent", action: "advance", jobId: "j1", detail: "a" });
    expect(() => logDb.db.exec("UPDATE audit SET actor = 'human'")).toThrow("append-only");
    expect(() => logDb.db.exec("DELETE FROM audit")).toThrow("append-only");
  });

  it("detects an edited line, a deleted line, and a forged extra line, even when the guard rails were removed", async () => {
    const edited = await setup();
    await edited.store.audit({ actor: "agent", action: "advance", jobId: "j1", detail: "a" });
    edited.attacker().exec("UPDATE audit SET actor = 'human' WHERE seq = 2");
    expect((await edited.store.verify("j1")).ok).toBe(false);
    await rm(join(root, "logs"), { recursive: true, force: true });
    await rm(join(root, "state"), { recursive: true, force: true });

    const deleted = await setup();
    await deleted.store.audit({ actor: "agent", action: "advance", jobId: "j1", detail: "a" });
    await deleted.store.audit({ actor: "agent", action: "advance", jobId: "j1", detail: "b" });
    deleted.attacker().exec("DELETE FROM audit WHERE seq = 2");
    expect((await deleted.store.verify("j1")).ok).toBe(false);
    await rm(join(root, "logs"), { recursive: true, force: true });
    await rm(join(root, "state"), { recursive: true, force: true });

    const forged = await setup();
    const tail = forged.logDb.auditRows("p", "j1").at(-1)?.hash ?? "";
    forged
      .attacker()
      .exec(
        `INSERT INTO audit (project, job_id, ts, actor, action, detail, state, prev, hash) VALUES ('p','j1','x','human','commit','sha','x','${tail}','${"f".repeat(64)}')`,
      );
    expect((await forged.store.verify("j1")).ok).toBe(false);
  });

  it("refuses to fork a chain: two lines cannot both follow the same line", async () => {
    const { logDb } = await setup();
    const first = logDb.auditRows("p", "j1")[0];
    expect(() =>
      logDb.db.exec(
        `INSERT INTO audit (project, job_id, ts, actor, action, detail, state, prev, hash) VALUES ('p','j1','x','human','commit','sha','x','${GENESIS}','${"e".repeat(64)}')`,
      ),
    ).toThrow("UNIQUE");
    expect(first?.prev).toBe(GENESIS);
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

  it("keeps two jobs, and two projects, apart in one database", async () => {
    const { logDb } = await setup();
    const other = createJobStore(join(root, "other"), undefined, { db: logDb, project: "q" });
    await other.create(factoryBuildPreset, "j1", "t", 3);
    await other.audit({ actor: "agent", action: "note", jobId: "j1", detail: "x" });
    expect(logDb.auditRows("p", "j1")).toHaveLength(1);
    expect(logDb.auditRows("q", "j1")).toHaveLength(2);
    expect((await other.verify("j1")).ok).toBe(true);
  });

  it("keeps the chain across a restart, because it is on disk", async () => {
    const { store, path, logDb } = await setup();
    await store.audit({ actor: "agent", action: "note", jobId: "j1", detail: "before" });
    logDb.close();
    const reopened = createJobStore(join(root, "state"), undefined, {
      db: openLogDb(path),
      project: "p",
    });
    await reopened.audit({ actor: "agent", action: "note", jobId: "j1", detail: "after" });
    expect(await reopened.verify("j1")).toEqual({ ok: true, entries: 3 });
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
    const { store, job, attacker } = await setup();
    const saved = await gateAt(store, job);
    await writeGate(store, "j1", 1, "PASS", "tree-1");
    attacker().exec("DELETE FROM audit WHERE seq = 1");
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
