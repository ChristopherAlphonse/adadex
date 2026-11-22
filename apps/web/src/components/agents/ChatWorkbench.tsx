import { type TranscriptMessage, splitMessageSegments } from "@adadex/core";
import {
  ArrowDown,
  CircleHelp,
  FileText,
  GitBranch,
  GitCommitHorizontal,
  type LucideIcon,
  MessageSquareMore,
  Info,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { useRef, useState } from "react";

import { cn } from "@/lib/utils";

import {
  type ActivityGroup,
  buildActivityGroups,
  buildCatchUp,
  collectChatLinks,
  collectEditedFiles,
} from "../../app/chatExtras";
import { useSessionStats } from "../../app/hooks/useSessionStats";
import { sendChannelMessage } from "../../app/sendChannelMessage";
import type { TerminalView } from "../../app/types";
import { buildConversationExportUrl } from "../../runtime/runtimeEndpoints";

export type ChatWorkbenchPanel =
  | ActivityGroup["kind"]
  | "side"
  | "catchup"
  | "files"
  | "details"
  | "help";

type SideEntry = { id: string; target: string; text: string };

type ChatWorkbenchProps = {
  columns: TerminalView;
  session: TerminalView[number] | null;
  messages: TranscriptMessage[] | null;
  panel: ChatWorkbenchPanel | null;
  onPanelChange: (panel: ChatWorkbenchPanel | null) => void;
  sideChatDraft: string;
  onSideChatDraftChange: (draft: string) => void;
  onSelectSession: (terminalId: string) => void;
  onBringBack: (text: string) => void;
  onScrollToBottom: () => void;
  onDelegate?: (() => void) | undefined;
  onCreateWorktree?: (() => void) | undefined;
  onOpenGit?: (() => void) | undefined;
};

const PANEL_LABEL: Record<ChatWorkbenchPanel, string> = {
  workers: "Workers in this coordination",
  tasks: "Agents that need you",
  subagents: "Child agents",
  background: "Agents working elsewhere",
  side: "Side chat",
  catchup: "Catch me up",
  files: "Files and links",
  details: "Session details",
  help: "Questions and shortcuts",
};

const PANEL_ICONS: readonly { panel: ChatWorkbenchPanel; icon: LucideIcon }[] = [
  { panel: "side", icon: MessageSquareMore },
  { panel: "catchup", icon: Sparkles },
  { panel: "files", icon: FileText },
  { panel: "details", icon: Info },
  { panel: "help", icon: CircleHelp },
];

const IconButton = ({
  icon: Icon,
  label,
  active = false,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick: () => void;
}) => (
  <button
    aria-label={label}
    aria-pressed={active}
    className={cn(
      "grid size-7 place-items-center rounded-md hover:bg-secondary hover:text-foreground",
      active ? "bg-secondary text-foreground" : "text-muted-foreground",
    )}
    onClick={onClick}
    title={label}
    type="button"
  >
    <Icon size={15} />
  </button>
);

const formatStarted = (iso: string | undefined): string => {
  const time = iso ? Date.parse(iso) : Number.NaN;

  return Number.isFinite(time) ? new Date(time).toLocaleString() : "—";
};

const stateLabel = (session: TerminalView[number]): string =>
  session.agentRuntimeState ?? session.state;

const SessionList = ({
  sessions,
  onSelect,
}: {
  sessions: TerminalView[number][];
  onSelect: (terminalId: string) => void;
}) => (
  <ul className="m-0 flex list-none flex-col gap-1 p-0">
    {sessions.length === 0 ? (
      <li className="text-muted-foreground">None right now.</li>
    ) : (
      sessions.map((item) => (
        <li key={item.terminalId}>
          <button
            className="w-full rounded-md px-2 py-1 text-left hover:bg-secondary"
            onClick={() => {
              onSelect(item.terminalId);
            }}
            type="button"
          >
            <span className="font-medium">{item.coordinationName || item.label}</span>{" "}
            <span className="text-xs text-muted-foreground">· {stateLabel(item)}</span>
          </button>
        </li>
      ))
    )}
  </ul>
);

/** The pills above the chat and the small panels they open. Every panel reads live session data. */
export const ChatWorkbench = ({
  columns,
  session,
  messages,
  panel,
  onPanelChange,
  sideChatDraft,
  onSideChatDraftChange,
  onSelectSession,
  onBringBack,
  onScrollToBottom,
  onDelegate,
  onCreateWorktree,
  onOpenGit,
}: ChatWorkbenchProps) => {
  const [sideTarget, setSideTarget] = useState("");
  const [sideHistory, setSideHistory] = useState<SideEntry[]>([]);
  const sideEntryIdRef = useRef(0);
  const [sideError, setSideError] = useState<string | null>(null);
  const stats = useSessionStats(session?.terminalId ?? null);

  const groups = buildActivityGroups(columns, session?.terminalId ?? null);
  const blocks = (messages ?? []).flatMap((message) => message.blocks);
  const files = collectEditedFiles(blocks);
  const links = collectChatLinks(messages ?? []);

  const questions = (messages ?? []).flatMap((message, messageIndex) =>
    message.blocks.flatMap((block, blockIndex) =>
      block.kind === "text"
        ? splitMessageSegments(block.text).flatMap((segment, segmentIndex) =>
            segment.kind === "form"
              ? [
                  {
                    key: `${message.id}-${messageIndex}-${blockIndex}-${segmentIndex}`,
                    title: segment.form.title,
                  },
                ]
              : [],
          )
        : [],
    ),
  );

  const targets = columns.filter((item) => item.terminalId !== session?.terminalId);

  const toggle = (next: ChatWorkbenchPanel) => {
    onPanelChange(panel === next ? null : next);
  };

  const ask = async () => {
    const text = sideChatDraft.trim();

    if (!text || !sideTarget) return;

    try {
      await sendChannelMessage(
        sideTarget,
        `[Side chat from ${session?.terminalId ?? "operator"}]: ${text}`,
      );
      sideEntryIdRef.current += 1;
      setSideHistory((current) => [
        ...current,
        { id: `side-${sideEntryIdRef.current}`, target: sideTarget, text },
      ]);
      onSideChatDraftChange("");
      setSideError(null);
    } catch (error) {
      setSideError(error instanceof Error ? error.message : "Unable to send the side chat.");
    }
  };

  const handoff = async () => {
    if (!sideTarget || !session) return;

    try {
      await sendChannelMessage(
        sideTarget,
        `Handoff from ${session.terminalId}: ${buildConversationExportUrl(session.terminalId, "md")}`,
      );
      setSideError(null);
    } catch (error) {
      setSideError(error instanceof Error ? error.message : "Unable to hand off the session.");
    }
  };

  const focusQuestion = (title: string) => {
    for (const element of document.querySelectorAll("[data-question-title]")) {
      if (element.getAttribute("data-question-title") === title) {
        element.scrollIntoView({ block: "center" });

        return;
      }
    }
  };

  const activeGroup = groups.find((group) => group.kind === panel);

  return (
    <div className="shrink-0 border-b border-border">
      <fieldset className="m-0 flex min-w-0 items-center gap-1 border-0 px-2 py-1.5">
        <legend className="sr-only">Chat activity</legend>
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {groups
            .filter((group) => group.sessions.length > 0 || panel === group.kind)
            .map((group) => (
              <button
                aria-label={`${group.label}, ${group.sessions.length}`}
                aria-pressed={panel === group.kind}
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-0.5 text-xs",
                  panel === group.kind
                    ? "bg-secondary font-medium text-foreground"
                    : "bg-surface-2 text-muted-foreground hover:text-foreground",
                )}
                key={group.kind}
                onClick={() => {
                  toggle(group.kind);
                }}
                type="button"
              >
                {group.label} <span className="font-mono">{group.sessions.length}</span>
              </button>
            ))}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {PANEL_ICONS.map(({ panel: item, icon: Icon }) => (
            <IconButton
              active={panel === item}
              icon={Icon}
              key={item}
              label={PANEL_LABEL[item]}
              onClick={() => {
                toggle(item);
              }}
            />
          ))}
          <IconButton
            icon={ArrowDown}
            label="Scroll to latest message"
            onClick={onScrollToBottom}
          />
          {onDelegate || onCreateWorktree || onOpenGit ? (
            <span aria-hidden className="mx-1 h-4 w-px bg-border" />
          ) : null}
          {onDelegate ? (
            <IconButton icon={UserPlus} label="Delegate to a child agent" onClick={onDelegate} />
          ) : null}
          {onCreateWorktree ? (
            <IconButton icon={GitBranch} label="New worktree agent" onClick={onCreateWorktree} />
          ) : null}
          {onOpenGit ? (
            <IconButton icon={GitCommitHorizontal} label="Git actions" onClick={onOpenGit} />
          ) : null}
        </div>
      </fieldset>

      {panel ? (
        <section
          aria-label={PANEL_LABEL[panel]}
          className="max-h-64 overflow-y-auto px-3 py-2 text-sm"
        >
          {activeGroup ? (
            <SessionList sessions={activeGroup.sessions} onSelect={onSelectSession} />
          ) : null}

          {panel === "side" ? (
            <div className="flex flex-col gap-2">
              <p className="m-0 text-xs text-muted-foreground">
                Ask another agent without leaving this session. Bring an answer back with one click.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Side chat agent"
                  className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                  onChange={(event) => {
                    setSideTarget(event.target.value);
                  }}
                  value={sideTarget}
                >
                  <option value="">Pick an agent…</option>
                  {targets.map((item) => (
                    <option key={item.terminalId} value={item.terminalId}>
                      {item.coordinationName || item.label}
                    </option>
                  ))}
                </select>
                <input
                  aria-label="Side chat message"
                  className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm"
                  onChange={(event) => {
                    onSideChatDraftChange(event.target.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void ask();
                    }
                  }}
                  placeholder="Ask a side question…"
                  value={sideChatDraft}
                />
                <button
                  className="rounded-md bg-foreground px-2 py-1 text-sm font-medium text-background disabled:opacity-40"
                  disabled={sideChatDraft.trim().length === 0 || sideTarget.length === 0}
                  onClick={() => {
                    void ask();
                  }}
                  type="button"
                >
                  Ask
                </button>
              </div>
              <button
                className="self-start rounded-md border border-border px-2 py-0.5 text-xs"
                disabled={!sideTarget || !session}
                onClick={() => {
                  void handoff();
                }}
                type="button"
              >
                Hand off this session
              </button>
              {sideError ? (
                <p className="m-0 text-xs text-destructive" role="alert">
                  {sideError}
                </p>
              ) : null}
              {sideHistory.length > 0 ? (
                <ul className="m-0 flex list-none flex-col gap-1 p-0">
                  {sideHistory.map((entry) => (
                    <li className="flex items-center gap-2" key={entry.id}>
                      <span className="min-w-0 flex-1 truncate">
                        {entry.target}: {entry.text}
                      </span>
                      <button
                        className="rounded-md border border-border px-2 py-0.5 text-xs"
                        onClick={() => {
                          onBringBack(entry.text);
                        }}
                        type="button"
                      >
                        Bring back
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {panel === "catchup" ? (
            <div className="flex flex-col gap-2">
              <p className="m-0">{buildCatchUp(session, messages, groups)}</p>
              <p className="m-0 text-xs text-muted-foreground">
                From live session state and the transcript. No model call.
              </p>
            </div>
          ) : null}

          {panel === "files" ? (
            <div className="flex flex-col gap-2">
              <p className="m-0 font-medium">
                {files.length === 0 ? "No edited files in this chat." : "Edited files"}
              </p>
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {files.map((file) => (
                  <li className="truncate font-mono text-xs" key={file.path}>
                    {file.path}{" "}
                    <span className="text-muted-foreground">
                      +{file.added} -{file.removed}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="m-0 font-medium">Links</p>
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {links.length === 0 ? (
                  <li className="text-muted-foreground">None in this chat.</li>
                ) : (
                  links.map((link) => (
                    <li className="truncate" key={link.href}>
                      <a
                        className="text-brand underline"
                        href={link.href}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))
                )}
              </ul>
              {session ? (
                <a
                  className="text-brand underline"
                  href={buildConversationExportUrl(session.terminalId, "md")}
                >
                  Export this session as Markdown
                </a>
              ) : null}
            </div>
          ) : null}

          {panel === "details" ? (
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt className="text-muted-foreground">Status</dt>
              <dd className="m-0">{session ? stateLabel(session) : "No session"}</dd>
              <dt className="text-muted-foreground">Coordination</dt>
              <dd className="m-0">{session?.coordinationId ?? "—"}</dd>
              <dt className="text-muted-foreground">Workspace</dt>
              <dd className="m-0">{session?.workspaceMode ?? "—"}</dd>
              <dt className="text-muted-foreground">Started</dt>
              <dd className="m-0">{formatStarted(session?.startedAt)}</dd>
              <dt className="text-muted-foreground">Context</dt>
              <dd className="m-0">
                {stats ? `${stats.contextTokens.toLocaleString()} tokens` : "Not recorded yet"}
              </dd>
              <dt className="text-muted-foreground">Requests</dt>
              <dd className="m-0">{stats?.requestCount ?? "—"}</dd>
            </dl>
          ) : null}

          {panel === "help" ? (
            <div className="flex flex-col gap-2">
              <p className="m-0 text-xs text-muted-foreground">
                Pick a question to jump to its card. G opens the graph view.
              </p>
              {questions.length === 0 ? (
                <p className="m-0 text-xs text-muted-foreground">No questions in this chat.</p>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-1 p-0">
                  {questions.map((question) => (
                    <li key={question.key}>
                      <button
                        className="rounded-md px-2 py-1 text-left hover:bg-secondary"
                        onClick={() => {
                          focusQuestion(question.title);
                        }}
                        type="button"
                      >
                        {question.title}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
};
