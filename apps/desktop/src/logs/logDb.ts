import { createHash } from "node:crypto";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

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

/** The body in one fixed key order, nothing undefined, so a line hashes the same when it is written and when it is checked. */
const canonical = (b: AuditBody): AuditBody => ({
  ts: b.ts,
  actor: b.actor,
  action: b.action,
  jobId: b.jobId,
  detail: b.detail,
  ...(b.role === undefined ? {} : { role: b.role }),
  ...(b.runId === undefined ? {} : { runId: b.runId }),
  ...(b.data === undefined ? {} : { data: b.data }),
  state: b.state,
});
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

const toRow = (r: RawRow): AuditRow => ({
  seq: r.seq,
  ts: r.ts,
  actor: r.actor,
  action: r.action,
  jobId: r.job_id,
  detail: r.detail,
  ...(r.role === null ? {} : { role: r.role }),
  ...(r.run_id === null ? {} : { runId: r.run_id }),
  ...(r.data === null ? {} : { data: JSON.parse(r.data) as Record<string, string | number> }),
  state: r.state,
  prev: r.prev,
  hash: r.hash,
  ...(r.sig === null ? {} : { sig: r.sig }),
  ...(r.key_id === null ? {} : { keyId: r.key_id }),
});

/**
 * Open (or create) the machine's local log database. It holds the audit chain and the operational events in
 * one SQLite file, readable only by the owner, with write-ahead logging and full sync so a crash loses nothing.
 */
export const openLogDb = (path: string): LogDb => {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA busy_timeout = 5000;");
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
      } catch {
        // The side files may not exist yet.
      }
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
        return {
          ...canonical(body),
          seq: Number(res.lastInsertRowid),
          prev,
          hash,
          ...(sig === null ? {} : { sig, keyId: signer?.keyId }),
        };
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
    auditRows: (project, jobId) => (rows.all(project, jobId) as unknown as RawRow[]).map(toRow),
    close: () => db.close(),
  };
};
