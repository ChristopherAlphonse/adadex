import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { factoryBuildPreset, factoryReviewPreset } from "@adadex/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createJobExecutor } from "../src/jobs/jobActions";
import { createJobStore } from "../src/jobs/jobStore";
import { parseKv } from "../src/jobs/kv";
import { readFacts } from "../src/jobs/readFacts";
import { writeGate } from "./helpers/attest";

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "adadex-jobs-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const workflows = { factory: factoryBuildPreset, "factory-review": factoryReviewPreset };
const setup = () => {
  const store = createJobStore(root, () => new Date("2026-11-19T00:00:00.000Z"));
  const effects: string[] = [];
  const executor = createJobExecutor({
    store,
    workflows,
    runEffect: async (n) => {
      effects.push(n);
    },
    actor: () => "agent",
  });
  return { store, executor, effects };
};

describe("parseKv", () => {
  it("reads KEY: value lines and keeps the first of a repeated key", () => {
    expect(parseKv("# Title\nSTATUS: READY\nFINDINGS: 3\nSTATUS: BLOCKED\nnot a key: x\n")).toEqual(
      { STATUS: "READY", FINDINGS: "3" },
    );
  });
});

describe("job store", () => {
  it("creates, loads, lists and refuses a duplicate or a bad id", async () => {
    const { store } = setup();
    await store.create(factoryBuildPreset, "j1", "Add login", 3);
    expect((await store.load("j1")).stage).toBe("shape");
    expect((await store.list()).map((j) => j.id)).toEqual(["j1"]);
    await expect(store.create(factoryBuildPreset, "j1", "x", 3)).rejects.toThrow("j1 exists");
    await expect(store.load("../evil")).rejects.toThrow();
  });

  it("writes an audit line for every create", async () => {
    const { store } = setup();
    await store.create(factoryBuildPreset, "j1", "Add login", 3);
    const line = (await store.readAudit("j1"))[0];
    expect(line).toMatchObject({
      actor: "system",
      action: "create",
      jobId: "j1",
      ts: "2026-11-19T00:00:00.000Z",
    });
  });
});

describe("readFacts", () => {
  it("reads documents, the gate, the reviews and the spec hash", async () => {
    const { store } = setup();
    const job = await store.create(factoryBuildPreset, "j1", "t", 3);
    const dir = store.jobDir("j1");
    await mkdir(join(dir, "round-1"), { recursive: true });
    await writeFile(join(dir, "build.md"), "STATUS: READY\n");
    await writeFile(join(dir, "spec.md"), "the spec");
    await writeGate(store, "j1", 1, "PASS");
    await writeFile(join(dir, "round-1", "review-code.md"), "VERDICT: CHANGES\n");
    const facts = await readFacts(store, { ...job, round: 1 });
    expect(facts.docs["build.md"]).toEqual({ STATUS: "READY" });
    expect(facts.gate).toBe("PASS");
    expect(facts.reviews).toEqual({ code: "CHANGES", qa: undefined, test: undefined });
    expect(facts.hashes?.spec).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("job actions on disk", () => {
  it("refuses an advance with no evidence and audits the refusal", async () => {
    const { store, executor } = setup();
    await store.create(factoryBuildPreset, "j1", "t", 3);
    await expect(executor.execute("job.advance", { id: "j1", to: "spec" })).rejects.toThrow(
      "shape.md needs STATUS: READY",
    );
    expect((await store.load("j1")).stage).toBe("shape");
    expect((await store.readAudit("j1")).map((l) => l.action)).toContain("advance-refused");
  });

  it("walks shape -> spec -> build, with the spec approval bound to its hash", async () => {
    const { store, executor, effects } = setup();
    await store.create(factoryBuildPreset, "j1", "t", 3);
    const dir = store.jobDir("j1");
    await writeFile(join(dir, "shape.md"), "STATUS: READY\n");
    await executor.execute("job.advance", { id: "j1", to: "spec" });
    await writeFile(join(dir, "spec.md"), "v1");
    await expect(executor.execute("job.advance", { id: "j1", to: "build" })).rejects.toThrow(
      "spec not approved by the user",
    );
    await executor.execute("job.approve_spec", { id: "j1" });
    await writeFile(join(dir, "spec.md"), "v2 changed after approval");
    await expect(executor.execute("job.advance", { id: "j1", to: "build" })).rejects.toThrow(
      "spec changed since the user approved it",
    );
    await executor.execute("job.approve_spec", { id: "j1" });
    const r = await executor.execute("job.advance", { id: "j1", to: "build" });
    expect(r).toEqual({ stage: "build", round: 1 });
    expect(effects).toEqual(["make-worktree"]);
  });

  it("parks a job when rounds run out, and unblock returns it to where it was", async () => {
    const { store, executor } = setup();
    const job = await store.create(factoryBuildPreset, "j1", "t", 1);
    await store.save({ ...job, stage: "gate", round: 1 });
    const _dir = store.jobDir("j1");
    await writeGate(store, "j1", 1, "FAIL");
    expect(await executor.execute("job.advance", { id: "j1", to: "build" })).toMatchObject({
      stage: "needs-human",
    });
    await expect(executor.execute("job.advance", { id: "j1", to: "gate" })).rejects.toThrow(
      "only the user can move it",
    );
    expect(await executor.execute("job.unblock", { id: "j1" })).toEqual({ stage: "gate" });
    // A job parked for running out of rounds gets a fresh allowance, and the reason is cleared.
    const back = await store.load("j1");
    expect(back).toMatchObject({ stage: "gate", round: 2, roundLimit: 5 });
    expect(back.note).toBeUndefined();
    expect(back.parkedFrom).toBeUndefined();
    expect((await store.verify("j1")).ok).toBe(true);
  });

  it("clears the polished flag when an unblocked job goes back to build", async () => {
    const { store, executor } = setup();
    const job = await store.create(factoryBuildPreset, "j1", "t", 3);
    await store.save({
      ...job,
      stage: "needs-human",
      parkedFrom: "build",
      flags: { polished: true },
      note: "stuck",
    });
    await store.audit({ actor: "system", action: "park", jobId: "j1", detail: "stuck" });
    await executor.execute("job.unblock", { id: "j1" });
    expect((await store.load("j1")).flags).toEqual({ polished: false });
  });

  it("refuses to unblock a job that is not parked", async () => {
    const { store, executor } = setup();
    await store.create(factoryBuildPreset, "j1", "t", 3);
    await expect(executor.execute("job.unblock", { id: "j1" })).rejects.toThrow("not parked");
  });

  it("runs a review job through a different workflow by its id", async () => {
    const { store, executor } = setup();
    await store.create(factoryReviewPreset, "r1", "t", 3);
    await writeFile(join(store.jobDir("r1"), "scope.md"), "STATUS: READY\n");
    expect(await executor.execute("job.advance", { id: "r1", to: "review" })).toMatchObject({
      stage: "review",
      round: 1,
    });
  });
});
