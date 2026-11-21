import { createHash } from "node:crypto";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { asRecord, isNumber, isString, type ParsedValue } from "@adadex/core";

export const GENESIS = "0".repeat(64);

const SCHEMA_VERSION = 2;

export const sha256 = (text: string): string => createHash("sha256").update(text).digest("hex");

export interface AuditBody {
  readonly ts: string;
  readonly actor: string;
  readonly action: string;
  readonly jobId: string;
  readonly detail: string;
  readonly role?: string | undefined;
  readonly runId?: string | undefined;
  readonly data?: Readonly<Record<string, string | number>> | undefined;
  /** Hash of the job record when this line was written. */
  readonly state: string;
}

export interface AuditRow extends AuditBody {
  readonly seq: number;
  readonly prev: string;
  readonly hash: string;
  /** Ed25519 signature of `hash` by the machine's key, and which key. Null for a line written before signing. */
  readonly sig?: string | undefined;
  readonly keyId?: string | undefined;
}

type MutableAuditBody = { -readonly [K in keyof AuditBody]: AuditBody[K] };

type MutableAuditRow = { -readonly [K in keyof AuditRow]: AuditRow[K] };

/** The body in one fixed key order, nothing undefined, so a line hashes the same when it is written and when it is checked. */
const canonical = (b: AuditBody): AuditBody => {
  const out: MutableAuditBody = {
    ts: b.ts,
    actor: b.actor,
    action: b.action,
    jobId: b.jobId,
    detail: b.detail,
    role: undefined,
    runId: undefined,
    data: undefined,
    state: b.state,
  };

  if (b.role === undefined) delete out.role;
  else out.role = b.role;

  if (b.runId === undefined) delete out.runId;
  else out.runId = b.runId;

  if (b.data === undefined) delete out.data;
  else out.data = b.data;

  return out;
};

export const lineHash = (prev: string, body: AuditBody): string =>
  sha256(prev + JSON.stringify(canonical(body)));

export interface LogDb {
  /** Append a line to a job's chain. Appends are atomic, and the table refuses updates and deletes. */
  appendAudit(
    project: string,
    body: AuditBody,
    signer?: { sign(data: string): string; keyId: string },
  ): AuditRow;
  auditRows(project: string, jobId: string): readonly AuditRow[];
  /** For the events table and queries. */
  readonly db: DatabaseSync;
  close(): void;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS audit (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT NOT NULL, job_id TEXT NOT NULL,
  ts TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, detail TEXT NOT NULL,
  role TEXT, run_id TEXT, data TEXT,
  state TEXT NOT NULL, prev TEXT NOT NULL, hash TEXT NOT NULL,
  sig TEXT, key_id TEXT,
  UNIQUE (project, job_id, prev)
);
CREATE INDEX IF NOT EXISTS audit_job ON audit (project, job_id, seq);
CREATE INDEX IF NOT EXISTS audit_run ON audit (run_id);
CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit BEGIN SELECT RAISE(ABORT, 'the audit log is append-only'); END;
CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit BEGIN SELECT RAISE(ABORT, 'the audit log is append-only'); END;
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL, level TEXT NOT NULL, source TEXT NOT NULL,
  project TEXT, job_id TEXT, run_id TEXT, role TEXT,
  message TEXT NOT NULL, data TEXT
);
CREATE INDEX IF NOT EXISTS events_ts ON events (ts);
CREATE INDEX IF NOT EXISTS events_job ON events (project, job_id, id);
`;

interface RawRow {
  seq: number;
  ts: string;
  actor: string;
  action: string;
  job_id: string;
  detail: string;
  role: string | null;
  run_id: string | null;
  data: string | null;
  state: string;
  prev: string;
  hash: string;
  sig: string | null;
  key_id: string | null;
}

const nullableText = (v: ParsedValue | undefined): v is string | null => v === null || isString(v);

const isRawRow = <T>(value: T): value is T & RawRow => {
  // SAFETY: SQLite returns plain row objects; the checks below establish the RawRow shape before use.
  const r = asRecord(value);

  return (
    r !== null &&
    isNumber(r.seq) &&
    isString(r.ts) &&
    isString(r.actor) &&
    isString(r.action) &&
    isString(r.job_id) &&
    isString(r.detail) &&
    nullableText(r.role) &&
    nullableText(r.run_id) &&
    nullableText(r.data) &&
    isString(r.state) &&
    isString(r.prev) &&
    isString(r.hash) &&
    nullableText(r.sig) &&
    nullableText(r.key_id)
  );
};

const toRow = (r: RawRow): AuditRow => {
  // SAFETY: the placeholders keep SQLite column order stable; missing columns are deleted below.
  const out: Omit<AuditRow, "role" | "runId" | "data" | "sig" | "keyId"> & {
    role?: string | undefined;
    runId?: string | undefined;
    data?: Readonly<Record<string, string | number>> | undefined;
    sig?: string | undefined;
    keyId?: string | undefined;
  } = {
    seq: r.seq,
    ts: r.ts,
    actor: r.actor,
    action: r.action,
    jobId: r.job_id,
    detail: r.detail,
    role: undefined,
    runId: undefined,
    data: undefined,
    state: r.state,
    prev: r.prev,
    hash: r.hash,
    sig: undefined,
    keyId: undefined,
  };

  if (r.role === null) delete out.role;
  else out.role = r.role;

  if (r.run_id === null) delete out.runId;
  else out.runId = r.run_id;

  if (r.data === null) {
    delete out.data;
  } else {
    // SAFETY: appendAudit stores only JSON.stringify of AuditBody.data in this column.
    out.data = JSON.parse(r.data) as Record<string, string | number>;
  }

  if (r.sig === null) delete out.sig;
  else out.sig = r.sig;

  if (r.key_id === null) delete out.keyId;
  else out.keyId = r.key_id;

  return out;
};

/**
 * Open (or create) the machine's local log database. It holds the audit chain and the operational events in
 * one SQLite file, readable only by the owner, with write-ahead logging and full sync so a crash loses nothing.
 */
export const openLogDb = (path: string): LogDb => {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA busy_timeout = 5000;");

  // SAFETY: SQLite always returns one row for PRAGMA user_version with a numeric column.
  const version = (db.prepare("PRAGMA user_version").get() as { user_version: number })
    .user_version;

  if (version > SCHEMA_VERSION)
    throw new Error(`the log database is from a newer version of the app (schema ${version})`);
  db.exec(SCHEMA);

  if (version === 1)
    db.exec("ALTER TABLE audit ADD COLUMN sig TEXT; ALTER TABLE audit ADD COLUMN key_id TEXT;");
  db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);

  if (path !== ":memory:") {
    for (const f of [path, `${path}-wal`, `${path}-shm`]) {
      try {
        chmodSync(f, 0o600);
      } catch {}
    }
  }

  const last = db.prepare(
    "SELECT hash FROM audit WHERE project = ? AND job_id = ? ORDER BY seq DESC LIMIT 1",
  );

  const insert = db.prepare(
    "INSERT INTO audit (project, job_id, ts, actor, action, detail, role, run_id, data, state, prev, hash, sig, key_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );

  const rows = db.prepare("SELECT * FROM audit WHERE project = ? AND job_id = ? ORDER BY seq");

  return {
    db,
    appendAudit(project, body, signer) {
      db.exec("BEGIN IMMEDIATE");

      try {
        // SAFETY: the last-row query selects only the hash column; no row means this is the chain's first line.
        const prev =
          (last.get(project, body.jobId) as { hash: string } | undefined)?.hash ?? GENESIS;

        const hash = lineHash(prev, body);
        const sig = signer?.sign(hash) ?? null;

        const res = insert.run(
          project,
          body.jobId,
          body.ts,
          body.actor,
          body.action,
          body.detail,
          body.role ?? null,
          body.runId ?? null,
          body.data === undefined ? null : JSON.stringify(body.data),
          body.state,
          prev,
          hash,
          sig,
          signer?.keyId ?? null,
        );

        db.exec("COMMIT");

        const row: MutableAuditRow = {
          ...canonical(body),
          seq: Number(res.lastInsertRowid),
          prev,
          hash,
        };

        if (sig !== null) {
          // SAFETY: a signature is only produced together with the key that made it.
          row.sig = sig;
          row.keyId = signer?.keyId;
        }

        return row;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
    auditRows: (project, jobId) => {
      const found = rows.all(project, jobId);

      if (!found.every(isRawRow)) throw new Error("the audit database contains a malformed row");

      return found.map(toRow);
    },
    close: () => db.close(),
  };
};
