import { appendFileSync, chmodSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

export interface Anchor {
  readonly project: string;
  readonly jobId: string;
  readonly seq: number;
  readonly hash: string;
  readonly ts: string;
}

/**
 * Where the newest line of each job's chain is written a second time, away from the database. If lines are
 * removed from the end of a chain, the anchor still names a line the database no longer has.
 * A shipping sink (to a central log) can implement the same two methods.
 */
export interface AnchorSink {
  append(anchor: Anchor): void;
  latest(project: string, jobId: string): Anchor | null;
}

export const createFileAnchors = (path: string): AnchorSink => ({
  append(anchor) {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    appendFileSync(path, `${JSON.stringify(anchor)}\n`, { mode: 0o600 });
    chmodSync(path, 0o600);
  },
  latest(project, jobId) {
    let text: string;

    try {
      text = readFileSync(path, "utf8");
    } catch {
      return null;
    }

    let found: Anchor | null = null;

    for (const line of text.split("\n")) {
      if (line === "") continue;

      try {
        const a = /* SAFETY: preceding checks establish the invariant this assertion encodes. */ JSON.parse(line) as Anchor;

        if (a.project === project && a.jobId === jobId && (found === null || a.seq > found.seq))
          found = a;
      } catch {}
    }

    return found;
  },
});
