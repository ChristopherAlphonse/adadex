import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app/createApp";
import { parseRequest } from "../src/ipc/contract";
import { openLogDb } from "../src/logs/logDb";
import { createLogger } from "../src/logs/logger";
import { redact, redactDeep } from "../src/logs/redact";

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "adadex-logs-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("redaction", () => {
  it("hides credentials in the common shapes and leaves ordinary text alone", () => {
    const secret = "sk-abcdefghijklmnopqrstuvwxyz123456";
    expect(redact(`calling with ${secret} now`)).toBe("calling with [redacted] now");
    expect(redact("token ghp_abcdefghijklmnopqrstuvwxyz1234")).toContain("[redacted]");
    expect(redact("AKIAABCDEFGHIJKLMNOP")).toBe("[redacted]");
    expect(redact("Authorization: Bearer abcdefghijklmnopqrstuvwx")).toContain("[redacted]");
    expect(redact("password=hunter2 and API_KEY: abc123")).toBe(
      "password=[redacted] and API_KEY: [redacted]",
    );
    expect(redact("ADADEX_HUMAN_KEY=deadbeef run")).toBe("ADADEX_HUMAN_KEY=[redacted] run");
    expect(redact("-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----")).toBe(
      "[redacted]",
    );
    expect(redact("npm test passed in 4s")).toBe("npm test passed in 4s");
  });

  it("redacts inside nested data and keeps its shape", () => {
    expect(redactDeep({ a: ["token=abc", { b: "fine" }], n: 3 })).toEqual({
      a: ["token=[redacted]", { b: "fine" }],
      n: 3,
    });
  });
});

describe("the local log database", () => {
  it("is created private to the owner, in write-ahead mode, and refuses a newer schema", async () => {
    const path = join(root, "logs", "adadex.db");
    const logDb = openLogDb(path);
    logDb.close();
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    expect((await stat(join(root, "logs"))).mode & 0o777).toBe(0o700);
    const raw = new DatabaseSync(path);
    expect(
      (raw.prepare("PRAGMA journal_mode").get() as { journal_mode: string }).journal_mode,
    ).toBe("wal");
    raw.exec("PRAGMA user_version = 99");
    raw.close();
    expect(() => openLogDb(path)).toThrow("newer version");
  });
});

describe("operational events", () => {
  const make = () => {
    const logDb = openLogDb(":memory:");
    let n = 0;
    const clock = () => new Date(Date.UTC(2026, 10, 19, 0, n++));
    return { logDb, logger: createLogger(logDb, "p", clock) };
  };

  it("stores events with their job, run and role, newest first, and redacts them", () => {
    const { logger } = make();
    logger.log("info", "run", "started", { jobId: "j1", runId: "r1", role: "builder" });
    logger.log("warn", "guard", "deny Bash: token=abc123", {
      jobId: "j1",
      data: { command: "curl -H 'Bearer abcdefghijklmnopqrstuvwx'" },
    });
    const events = logger.query();
    expect(events.map((e) => e.message)).toEqual(["deny Bash: token=[redacted]", "started"]);
    expect(events[1]).toMatchObject({
      jobId: "j1",
      runId: "r1",
      role: "builder",
      level: "info",
      source: "run",
    });
    expect(JSON.stringify(events[0]?.data)).not.toContain("abcdefghijklmnopqrstuvwx");
  });

  it("filters by job, run, role, source, level and time, and caps the number returned", () => {
    const { logger } = make();
    logger.log("debug", "a", "one", { jobId: "j1" });
    logger.log("info", "b", "two", { jobId: "j2", role: "reviewer" });
    logger.log("error", "a", "three", { jobId: "j1", runId: "r9" });
    expect(logger.query({ jobId: "j1" }).map((e) => e.message)).toEqual(["three", "one"]);
    expect(logger.query({ role: "reviewer" }).map((e) => e.message)).toEqual(["two"]);
    expect(logger.query({ runId: "r9" }).map((e) => e.message)).toEqual(["three"]);
    expect(logger.query({ source: "a" })).toHaveLength(2);
    expect(logger.query({ level: "info" }).map((e) => e.message)).toEqual(["three", "two"]);
    expect(logger.query({ level: "error" })).toHaveLength(1);
    expect(logger.query({ limit: 1 })).toHaveLength(1);
    expect(logger.query({ since: "2026-11-19T00:02:00.000Z" }).map((e) => e.message)).toEqual([
      "three",
    ]);
  });

  it("keeps projects apart", () => {
    const { logDb } = make();
    createLogger(logDb, "p").log("info", "x", "mine");
    createLogger(logDb, "q").log("info", "x", "theirs");
    expect(
      createLogger(logDb, "p")
        .query()
        .map((e) => e.message),
    ).toEqual(["mine"]);
  });

  it("deletes old events but never touches the audit chain", () => {
    const logDb = openLogDb(":memory:");
    const old = createLogger(logDb, "p", () => new Date("2026-01-01T00:00:00.000Z"));
    old.log("info", "x", "old");
    const fresh = createLogger(logDb, "p", () => new Date("2026-11-19T00:00:00.000Z"));
    fresh.log("info", "x", "fresh");
    logDb.appendAudit("p", {
      ts: "2026-01-01T00:00:00.000Z",
      actor: "system",
      action: "create",
      jobId: "j1",
      detail: "t",
      state: "s",
    });
    expect(fresh.prune(90)).toBe(1);
    expect(fresh.query().map((e) => e.message)).toEqual(["fresh"]);
    expect(logDb.auditRows("p", "j1")).toHaveLength(1);
  });

  it("never lets a logging failure stop the caller", () => {
    const logDb = openLogDb(":memory:");
    const logger = createLogger(logDb, "p");
    logDb.close();
    expect(() => logger.log("info", "x", "after close")).not.toThrow();
  });
});

describe("requests for logs are checked", () => {
  it("accepts a filter and refuses a bad level, limit or id", () => {
    expect(parseRequest({ kind: "logs.query", jobId: "j1", level: "warn", limit: 50 }).ok).toBe(
      true,
    );
    expect(parseRequest({ kind: "logs.query" }).ok).toBe(true);
    expect(parseRequest({ kind: "logs.query", level: "loud" }).ok).toBe(false);
    expect(parseRequest({ kind: "logs.query", limit: 5000 }).ok).toBe(false);
    expect(parseRequest({ kind: "logs.query", jobId: "" }).ok).toBe(false);
    expect(parseRequest({ kind: "audit.verify", jobId: "j1" }).ok).toBe(true);
    expect(parseRequest({ kind: "audit.verify" }).ok).toBe(false);
  });
});

describe("the app logs to its local database", () => {
  it("records actions, approvals and processes, serves them to the UI, and verifies a job's chain on request", async () => {
    const project = join(root, "project");
    const dataDir = join(root, "data");
    await mkdir(project, { recursive: true });
    await mkdir(dataDir, { recursive: true });
    const env = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };
    execFileSync("git", ["init", "-b", "main"], { cwd: project, env });
    await writeFile(join(dataDir, "project.json"), JSON.stringify({ checks: "true" }));
    const app = createApp({
      projectRoot: project,
      dataDir,
      confirm: async () => false,
      emit: () => {},
      bridgePath: "/unused",
      hookPath: "/unused",
    });

    const waiting = app.approvals.gate.request("tool:Bash", "git commit -m x needs a human");
    app.approvals.respond(app.approvals.pending()[0]?.approvalId ?? "", false);
    expect(await waiting).toBe(false);
    await app.api.handle({
      kind: "action.run",
      actionId: "job.advance",
      input: { id: "nope", to: "spec" },
    });

    const events = (await app.api.handle({ kind: "logs.query", limit: 50 })) as {
      data: { source: string; message: string }[];
    };
    const messages = events.data.map((e) => `${e.source}: ${e.message}`);
    expect(messages).toContain("app: app started");
    expect(messages.some((m) => m.startsWith("approval: approval requested for tool:Bash"))).toBe(
      true,
    );
    expect(messages.some((m) => m.startsWith("approval: declined approval-1"))).toBe(true);
    expect(messages.some((m) => m.startsWith("action: ui ran job.advance: error"))).toBe(true);
    expect((await app.api.handle({ kind: "audit.verify", jobId: "nope" })) as unknown).toEqual({
      ok: true,
      data: { ok: true, entries: 0 },
    });

    await app.shutdown();
    app.close();
    const raw = new DatabaseSync(join(dataDir, "logs", "adadex.db"));
    expect(
      (
        raw.prepare("SELECT COUNT(*) AS n FROM events WHERE message = 'app stopping'").get() as {
          n: number;
        }
      ).n,
    ).toBe(1);
    raw.close();
    expect((await stat(join(dataDir, "logs", "adadex.db"))).mode & 0o777).toBe(0o600);
  });
});
