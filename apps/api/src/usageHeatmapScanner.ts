/**
 * Token usage heatmap built from Claude Code session transcripts
 * (`~/.claude/projects/<project>/<session>.jsonl`). Each assistant message carries a
 * `usage` block and a `model`; messages are deduplicated by message id because
 * transcripts can repeat them across resumed sessions.
 */
import { createReadStream } from "node:fs";
import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { createInterface } from "node:readline";

import { asRecord, isNumber, isString, type ParsedValue } from "@adadex/core";

export type UsageSlice = {
  key: string;
  tokens: number;
};

export type UsageDayEntry = {
  date: string;
  totalTokens: number;
  projects: UsageSlice[];
  models: UsageSlice[];
  sessions: number;
};

export type UsageChartResponse = {
  days: UsageDayEntry[];
  projects: string[];
  models: string[];
};

type DayAccumulator = {
  total: number;
  projects: Map<string, number>;
  models: Map<string, number>;
  sessions: Set<string>;
};

const numberOrZero = (value: ParsedValue | undefined): number =>
  isNumber(value) && Number.isFinite(value) ? value : 0;

const localDateKey = (timestamp: string): string | null => {
  const parsed = new Date(timestamp);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");

  return `${parsed.getFullYear()}-${month}-${day}`;
};

// Claude Code names a project's transcript dir after its path with non-alphanumerics as "-".
const toProjectDirName = (cwd: string): string => cwd.replace(/[^a-zA-Z0-9]/g, "-");

const addTo = (map: Map<string, number>, key: string, tokens: number): void => {
  map.set(key, (map.get(key) ?? 0) + tokens);
};

const toSlices = (map: Map<string, number>): UsageSlice[] =>
  [...map.entries()].map(([key, tokens]) => ({ key, tokens })).sort((a, b) => b.tokens - a.tokens);

const rankKeys = (totals: Map<string, number>): string[] =>
  [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([key]) => key);

const listTranscripts = async (projectsDir: string, onlyDir: string | null): Promise<string[]> => {
  let dirNames: string[];

  try {
    dirNames = onlyDir ? [onlyDir] : await readdir(projectsDir);
  } catch {
    return [];
  }

  const files: string[] = [];

  for (const dirName of dirNames) {
    try {
      const entries = await readdir(join(projectsDir, dirName));

      for (const entry of entries) {
        if (entry.endsWith(".jsonl")) {
          files.push(join(projectsDir, dirName, entry));
        }
      }
    } catch {
      // Not a directory, or it vanished mid-scan.
    }
  }

  return files;
};

export const scanUsageHeatmap = async (
  scope: "all" | "project",
  workspaceCwd: string,
): Promise<UsageChartResponse> => {
  const claudeDir = process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude");
  const projectsDir = join(claudeDir, "projects");

  const files = await listTranscripts(
    projectsDir,
    scope === "project" ? toProjectDirName(workspaceCwd) : null,
  );

  const days = new Map<string, DayAccumulator>();
  const projectTotals = new Map<string, number>();
  const modelTotals = new Map<string, number>();
  const seenMessages = new Set<string>();

  for (const file of files) {
    const lines = createInterface({ input: createReadStream(file), crlfDelay: Infinity });

    try {
      for await (const line of lines) {
        if (!line.includes('"usage"')) {
          continue;
        }

        let parsed: ParsedValue;

        try {
          // SAFETY: JSON.parse only yields JSON scalars, arrays, or plain objects.
          parsed = JSON.parse(line) as ParsedValue;
        } catch {
          continue;
        }

        const entry = asRecord(parsed);
        const message = entry ? asRecord(entry.message) : null;

        if (entry === null || message === null || !isString(entry.timestamp)) {
          continue;
        }

        const usage = asRecord(message.usage);
        const { model, id } = message;

        if (usage === null || !isString(model) || model.startsWith("<")) {
          continue;
        }

        if (isString(id)) {
          if (seenMessages.has(id)) {
            continue;
          }

          seenMessages.add(id);
        }

        // Cache reads are excluded: they re-count the whole context every turn and would dwarf real usage.
        const tokens =
          numberOrZero(usage.input_tokens) +
          numberOrZero(usage.output_tokens) +
          numberOrZero(usage.cache_creation_input_tokens);

        const date = localDateKey(entry.timestamp);

        if (tokens === 0 || date === null) {
          continue;
        }

        const project =
          isString(entry.cwd) && entry.cwd.length > 0
            ? basename(entry.cwd)
            : basename(file, ".jsonl");

        const sessionId = isString(entry.sessionId) ? entry.sessionId : file;

        const day = days.get(date) ?? {
          total: 0,
          projects: new Map<string, number>(),
          models: new Map<string, number>(),
          sessions: new Set<string>(),
        };

        day.total += tokens;
        addTo(day.projects, project, tokens);
        addTo(day.models, model, tokens);
        day.sessions.add(sessionId);
        days.set(date, day);
        addTo(projectTotals, project, tokens);
        addTo(modelTotals, model, tokens);
      }
    } catch {
      // Unreadable transcript: skip it rather than failing the whole chart.
    }
  }

  return {
    days: [...days.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, day]) => ({
        date,
        totalTokens: day.total,
        projects: toSlices(day.projects),
        models: toSlices(day.models),
        sessions: day.sessions.size,
      })),
    projects: rankKeys(projectTotals),
    models: rankKeys(modelTotals),
  };
};
