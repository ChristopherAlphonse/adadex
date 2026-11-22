import {
  type DiffLine,
  type ParsedRecord,
  type TranscriptBlock,
  type TranscriptMessage,
  asString,
  extractDiff,
  isSubagentToolCall,
  splitQuestionForms,
} from "@adadex/core";
import { useMemo } from "react";

import { cn } from "@/lib/utils";

import { QuestionCard } from "./QuestionCard";
import { MarkdownContent } from "./ui/MarkdownContent";

type ToolCallBlock = Extract<TranscriptBlock, { kind: "tool-call" }>;

type ToolResultBlock = Extract<TranscriptBlock, { kind: "tool-result" }>;

type EditedFile = { path: string; added: number; removed: number; lines: DiffLine[] };

type Turn =
  | { kind: "user"; id: string; text: string }
  | { kind: "agent"; id: string; messages: TranscriptMessage[] };

const SUMMARY_FIELDS = ["command", "file_path", "pattern", "url", "description", "path"];

const summarizeInput = (input: ParsedRecord): string => {
  for (const field of SUMMARY_FIELDS) {
    const value = asString(input[field]);

    if (value) {
      return value.length > 100 ? `${value.slice(0, 97)}...` : value;
    }
  }

  return "";
};

const textOf = (message: TranscriptMessage): string =>
  message.blocks.flatMap((block) => (block.kind === "text" ? [block.text] : [])).join("\n");

/** A user message starts a new turn; everything until the next user message is one agent turn. */
const toTurns = (messages: TranscriptMessage[]): Turn[] => {
  const turns: Turn[] = [];

  for (const message of messages) {
    const last = turns[turns.length - 1];

    if (message.role === "user") {
      turns.push({ kind: "user", id: message.id, text: textOf(message) });
    } else if (last?.kind === "agent") {
      last.messages.push(message);
    } else {
      turns.push({ kind: "agent", id: message.id, messages: [message] });
    }
  }

  return turns;
};

const formatDuration = (messages: TranscriptMessage[]): string | null => {
  const times = messages.flatMap((message) => {
    const time = message.timestamp ? Date.parse(message.timestamp) : Number.NaN;

    return Number.isFinite(time) ? [time] : [];
  });

  if (times.length < 2) {
    return null;
  }

  const seconds = Math.round((Math.max(...times) - Math.min(...times)) / 1000);

  if (seconds < 1) {
    return null;
  }

  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
};

const collectEditedFiles = (calls: ToolCallBlock[]): EditedFile[] => {
  const files = new Map<string, EditedFile>();

  for (const call of calls) {
    const diff = extractDiff(call.name, call.input);
    const path = asString(call.input.file_path) ?? asString(call.input.path);

    if (diff && path) {
      const file = files.get(path) ?? { path, added: 0, removed: 0, lines: [] };

      file.added += diff.lines.filter((line) => line.kind === "add").length;
      file.removed += diff.lines.filter((line) => line.kind === "del").length;
      file.lines.push(...diff.lines);
      files.set(path, file);
    }
  }

  return [...files.values()];
};

const keyedLines = (lines: DiffLine[]) => {
  const seen = new Map<string, number>();

  return lines.map((line) => {
    const base = `${line.kind}:${line.text}`;
    const count = seen.get(base) ?? 0;

    seen.set(base, count + 1);

    return { line, key: `${base}#${count}` };
  });
};

const LINE_TONE: Record<DiffLine["kind"], string> = {
  add: "bg-running/15",
  del: "bg-destructive/15",
  meta: "text-muted-foreground",
  context: "",
};

const DiffView = ({ lines }: { lines: DiffLine[] }) => (
  <pre className="m-0 max-h-80 overflow-auto px-3 py-2 font-mono text-xs">
    {keyedLines(lines).map(({ line, key }) => (
      <span className={cn("block", LINE_TONE[line.kind])} key={key}>
        {line.text}
        {"\n"}
      </span>
    ))}
  </pre>
);

const Counts = ({ added, removed }: { added: number; removed: number }) => (
  <span className="font-mono text-xs">
    <span className="text-running">+{added}</span>{" "}
    <span className="text-destructive">-{removed}</span>
  </span>
);

const ToolCallCard = ({
  block,
  result,
}: {
  block: ToolCallBlock;
  result?: ToolResultBlock | undefined;
}) => {
  const summary = summarizeInput(block.input);

  return (
    <details
      className={cn(
        "rounded-lg border border-border bg-card text-xs",
        result?.isError ? "border-destructive" : "",
      )}
    >
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-1.5">
        <span className="font-semibold">{block.name}</span>
        {isSubagentToolCall(block.name) ? (
          <span className="rounded-full bg-surface-2 px-1.5 text-[11px]">sub-agent</span>
        ) : null}
        {summary ? <span className="truncate text-muted-foreground">{summary}</span> : null}
      </summary>
      {result?.text ? (
        <pre className="m-0 max-h-80 overflow-auto px-3 py-2 font-mono text-xs">{result.text}</pre>
      ) : null}
    </details>
  );
};

const EditedFiles = ({ files }: { files: EditedFile[] }) => {
  const added = files.reduce((sum, file) => sum + file.added, 0);
  const removed = files.reduce((sum, file) => sum + file.removed, 0);

  return (
    <section
      aria-label="Edited files"
      className="overflow-hidden rounded-xl border border-border bg-card"
    >
      <header className="flex items-center justify-between px-3 py-2 text-sm font-medium">
        <span>Edited {files.length === 1 ? "1 file" : `${files.length} files`}</span>
        <Counts added={added} removed={removed} />
      </header>
      {files.map((file) => (
        <details className="border-t border-border" key={file.path}>
          <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-1.5 text-xs">
            <span className="truncate font-mono">{file.path}</span>
            <Counts added={file.added} removed={file.removed} />
          </summary>
          <DiffView lines={file.lines} />
        </details>
      ))}
    </section>
  );
};

const WorkSummary = ({
  calls,
  results,
  duration,
  fileCount,
}: {
  calls: ToolCallBlock[];
  results: Map<string, ToolResultBlock>;
  duration: string | null;
  fileCount: number;
}) => (
  <details className="rounded-xl bg-surface-2 text-sm">
    <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-3 py-2">
      <span className="font-medium">{duration ? `Worked ${duration}` : "Worked"}</span>
      <span className="rounded-full border border-border px-2 text-xs text-muted-foreground">
        {calls.length === 1 ? "1 tool call" : `${calls.length} tool calls`}
      </span>
      {fileCount > 0 ? (
        <span className="rounded-full border border-border px-2 text-xs text-muted-foreground">
          {fileCount === 1 ? "1 file" : `${fileCount} files`}
        </span>
      ) : null}
    </summary>
    <div className="flex flex-col gap-1.5 px-2 pb-2">
      {calls.map((call) => (
        <ToolCallCard block={call} key={call.toolUseId} result={results.get(call.toolUseId)} />
      ))}
    </div>
  </details>
);

const ANSWERS_TITLE = /^Answers to "([^"]*)":/;

const AgentTurn = ({
  messages,
  results,
  answered,
  onSendAnswer,
}: {
  messages: TranscriptMessage[];
  results: Map<string, ToolResultBlock>;
  answered: ReadonlySet<string>;
  onSendAnswer?: ((text: string) => Promise<void>) | undefined;
}) => {
  const calls = messages.flatMap((message) =>
    message.blocks.flatMap((block) => (block.kind === "tool-call" ? [block] : [])),
  );

  const files = collectEditedFiles(calls);

  const segments = messages.flatMap((message) =>
    message.blocks.flatMap((block, index) =>
      block.kind === "text"
        ? splitQuestionForms(block.text).map((segment, position) => ({
            key: `${message.id}-${index}-${position}`,
            segment,
          }))
        : [],
    ),
  );

  return (
    <li className="flex max-w-[92%] flex-col items-stretch gap-2 self-start" data-role="assistant">
      {calls.length > 0 ? (
        <WorkSummary
          calls={calls}
          duration={formatDuration(messages)}
          fileCount={files.length}
          results={results}
        />
      ) : null}
      {files.length > 0 ? <EditedFiles files={files} /> : null}
      {segments.map(({ key, segment }) =>
        segment.kind === "form" ? (
          <QuestionCard
            answered={answered.has(segment.form.title)}
            form={segment.form}
            key={key}
            onSend={onSendAnswer}
          />
        ) : (
          <div className="chat-bubble rounded-2xl bg-surface-2 px-3.5 py-2" key={key}>
            <MarkdownContent content={segment.text} className="chat-bubble-content" />
          </div>
        ),
      )}
    </li>
  );
};

export const ConversationChatThread = ({
  messages,
  onSendAnswer,
}: {
  messages: TranscriptMessage[];
  /** Sends a question card's answers to the agent. Without it, cards are read-only. */
  onSendAnswer?: ((text: string) => Promise<void>) | undefined;
}) => {
  const results = useMemo(() => {
    const map = new Map<string, ToolResultBlock>();

    for (const message of messages) {
      for (const block of message.blocks) {
        if (block.kind === "tool-result") {
          map.set(block.toolUseId, block);
        }
      }
    }

    return map;
  }, [messages]);

  const turns = useMemo(() => toTurns(messages), [messages]);

  const answered = useMemo(() => {
    const titles = new Set<string>();

    for (const turn of turns) {
      const title = turn.kind === "user" ? ANSWERS_TITLE.exec(turn.text)?.[1] : undefined;

      if (title !== undefined) {
        titles.add(title);
      }
    }

    return titles;
  }, [turns]);

  return (
    <ol className="chat-thread flex flex-col gap-4">
      {turns.map((turn) =>
        turn.kind === "user" ? (
          <li
            className="max-w-[78%] self-end rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm text-primary-foreground"
            data-role="user"
            key={turn.id}
          >
            {turn.text}
          </li>
        ) : (
          <AgentTurn
            answered={answered}
            key={turn.id}
            messages={turn.messages}
            onSendAnswer={onSendAnswer}
            results={results}
          />
        ),
      )}
    </ol>
  );
};
