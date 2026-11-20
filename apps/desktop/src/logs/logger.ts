import { asRecord, isNumber, isString, type ParsedValue } from "@adadex/core";

import type { LogDb } from "./logDb";
import { type RedactableValue, redact, redactDeep } from "./redact";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: readonly LogLevel[] = ["debug", "info", "warn", "error"];

export interface LogContext {
  readonly jobId?: string;
  readonly runId?: string;
  readonly role?: string;
  readonly data?: RedactableValue;
}

export interface LogQuery {
  readonly jobId?: string;
  readonly runId?: string;
  readonly role?: string;
  readonly source?: string;
  /** This level and above. */
  readonly level?: LogLevel;
  readonly since?: string;
  readonly limit?: number;
}

export interface LogEvent {
  readonly id: number;
  readonly ts: string;
  readonly level: LogLevel;
  readonly source: string;
  readonly jobId?: string;
  readonly runId?: string;
  readonly role?: string;
  readonly message: string;
  readonly data?: ParsedValue;
}

type MutableLogEvent = { -readonly [K in keyof LogEvent]: LogEvent[K] };

export interface Logger {
  log(level: LogLevel, source: string, message: string, context?: LogContext): void;
  /** Newest first. */
  query(q?: LogQuery): readonly LogEvent[];
  /** Delete events older than this many days. The audit chain is never pruned. Returns how many were removed. */
  prune(olderThanDays: number): number;
}

interface Raw {
  id: number;
  ts: string;
  level: LogLevel;
  source: string;
  job_id: string | null;
  run_id: string | null;
  role: string | null;
  message: string;
  data: string | null;
}

const isLevel = (v: ParsedValue | undefined): v is LogLevel => LEVELS.some((level) => level === v);

const nullableText = (v: ParsedValue | undefined): v is string | null => v === null || isString(v);

const isRaw = <T>(value: T): value is T & Raw => {
  // SAFETY: SQLite returns plain row objects; the checks below establish the Raw shape before use.
  const r = asRecord(value);

  return (
    r !== null &&
    isNumber(r.id) &&
    isString(r.ts) &&
    isLevel(r.level) &&
    isString(r.source) &&
    nullableText(r.job_id) &&
    nullableText(r.run_id) &&
    nullableText(r.role) &&
    isString(r.message) &&
    nullableText(r.data)
  );
};

/**
 * Operational events (guard decisions, approvals, processes, the loop) in the local database, for one project.
 * Everything is redacted before it is written, and a failure to log never stops the app.
 */
export const createLogger = (
  logDb: LogDb,
  project: string,
  now: () => Date = () => new Date(),
): Logger => ({
  log(level, source, message, context = {}) {
    try {
      logDb.db
        .prepare(
          "INSERT INTO events (ts, level, source, project, job_id, run_id, role, message, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          now().toISOString(),
          level,
          source,
          project,
          context.jobId ?? null,
          context.runId ?? null,
          context.role ?? null,
          redact(message),
          context.data === undefined ? null : JSON.stringify(redactDeep(context.data)),
        );
    } catch {}
  },
  query(q = {}) {
    const where: string[] = ["project = ?"];
    const args: (string | number)[] = [project];

    for (const [column, value] of [
      ["job_id", q.jobId],
      ["run_id", q.runId],
      ["role", q.role],
      ["source", q.source],
    ] as const) {
      if (value !== undefined) {
        where.push(`${column} = ?`);
        args.push(value);
      }
    }

    if (q.level !== undefined) {
      const allowed = LEVELS.slice(LEVELS.indexOf(q.level));
      where.push(`level IN (${allowed.map(() => "?").join(",")})`);
      args.push(...allowed);
    }

    if (q.since !== undefined) {
      where.push("ts >= ?");
      args.push(q.since);
    }

    args.push(Math.min(Math.max(q.limit ?? 200, 1), 1000));

    const found = logDb.db
      .prepare(`SELECT * FROM events WHERE ${where.join(" AND ")} ORDER BY id DESC LIMIT ?`)
      .all(...args);

    if (!found.every(isRaw)) throw new Error("the event database contains a malformed row");

    return found.map((r) => {
      const event: MutableLogEvent = {
        id: r.id,
        ts: r.ts,
        level: r.level,
        source: r.source,
        message: r.message,
      };

      if (r.job_id !== null) event.jobId = r.job_id;

      if (r.run_id !== null) event.runId = r.run_id;

      if (r.role !== null) event.role = r.role;

      if (r.data !== null) {
        // SAFETY: the data column only holds JSON written by this logger after redaction.
        event.data = JSON.parse(r.data) as ParsedValue;
      }

      return event;
    });
  },
  prune(days) {
    const cutoff = new Date(now().getTime() - days * 86_400_000).toISOString();

    return Number(logDb.db.prepare("DELETE FROM events WHERE ts < ?").run(cutoff).changes);
  },
});
