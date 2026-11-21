import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  type ParsedRecord,
  type TerminalAgentProvider,
  asRecord,
  isParsedRecord,
  isString,
} from "@adadex/core";

import { writeTextFileAtomic } from "../atomicJsonFile";

/**
 * Each agent CLI reports its session to the same Adadex endpoints, so the hooks are described once here
 * and written out in the format each CLI reads:
 * - Claude Code: `.claude/settings.local.json`
 * - OpenCode: `.opencode/plugins/adadex.ts` (OpenCode hooks are plugins, not shell commands)
 * - Kiro: `.kiro/hooks/adadex.json`
 */
type HookEvent = "SessionStart" | "UserPromptSubmit" | "PreToolUse" | "Notification" | "Stop";

type AdadexHook = {
  name: string;
  event: HookEvent;
  path: string;
  timeout?: number;
};

const DEFAULT_HOOK_TIMEOUT_SECONDS = 5;

// The PostToolUse hook was removed with Code Intel; reinstalling clears copies earlier installs left behind.
const LEGACY_POST_TOOL_USE_PATH = "/api/code-intel/events";

const LEGACY_POST_TOOL_USE_NAME = "adadex-post-tool-use";

const ADADEX_HOOKS: readonly AdadexHook[] = [
  { name: "adadex-session-start", event: "SessionStart", path: "/api/hooks/session-start" },
  {
    name: "adadex-user-prompt-submit",
    event: "UserPromptSubmit",
    path: "/api/hooks/user-prompt-submit",
  },
  { name: "adadex-pre-tool-use", event: "PreToolUse", path: "/api/hooks/pre-tool-use" },
  { name: "adadex-notification", event: "Notification", path: "/api/hooks/notification" },
  { name: "adadex-stop", event: "Stop", path: "/api/hooks/stop", timeout: 15 },
];

const curlCommand = (apiBaseUrl: string, hook: AdadexHook) => {
  const url = `${apiBaseUrl}${hook.path}?adadex_session=$ADADEX_SESSION_ID`;
  const post = `curl -s -X POST "${url}" -H 'Content-Type: application/json' -d @-`;

  // PreToolUse blocks the tool call on a non-zero exit, so it must succeed even when the API is down.
  return hook.event === "PreToolUse" ? `${post} ; exit 0` : `${post} || true`;
};

const readTextFile = (file: string): string | null => {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return null;
  }
};

const readJsonRecord = (file: string): ParsedRecord | null => {
  const text = readTextFile(file);

  if (text === null) return null;

  try {
    return asRecord(JSON.parse(text));
  } catch {
    return null;
  }
};

/** Skips unchanged files so a new terminal does not make a running agent reload its hooks. */
const writeIfChanged = (file: string, contents: string) => {
  if (readTextFile(file) !== contents) writeTextFileAtomic(file, contents);
};

const writeJsonFile = (file: string, value: ParsedRecord) => {
  writeIfChanged(file, `${JSON.stringify(value, null, 2)}\n`);
};

const installClaudeHooks = (targetCwd: string, apiBaseUrl: string) => {
  const file = join(targetCwd, ".claude", "settings.local.json");
  const settings = readJsonRecord(file) ?? {};
  const hooks: ParsedRecord = isParsedRecord(settings.hooks) ? settings.hooks : {};

  for (const hook of ADADEX_HOOKS) {
    const existingGroups = hooks[hook.event];

    // Drop any group an earlier install wrote for this hook, so reinstalling never duplicates it.
    const groups = Array.isArray(existingGroups)
      ? existingGroups.filter((group) => !JSON.stringify(group).includes(hook.path))
      : [];

    groups.push({
      matcher: "*",
      hooks: [
        {
          type: "command",
          command: curlCommand(apiBaseUrl, hook),
          timeout: hook.timeout ?? DEFAULT_HOOK_TIMEOUT_SECONDS,
        },
      ],
    });
    hooks[hook.event] = groups;
  }

  if (Array.isArray(hooks.PostToolUse)) {
    const remaining = hooks.PostToolUse.filter(
      (group) => !JSON.stringify(group).includes(LEGACY_POST_TOOL_USE_PATH),
    );

    if (remaining.length > 0) {
      hooks.PostToolUse = remaining;
    } else {
      delete hooks.PostToolUse;
    }
  }

  writeJsonFile(file, { ...settings, hooks });
};

const installKiroHooks = (targetCwd: string, apiBaseUrl: string) => {
  const file = join(targetCwd, ".kiro", "hooks", "adadex.json");

  // Kiro has no Notification trigger, so permission and idle prompts are not reported.
  const nextHooks = ADADEX_HOOKS.flatMap((hook) =>
    hook.event === "Notification"
      ? []
      : [
          {
            name: hook.name,
            trigger: hook.event,
            matcher: "*",
            action: { type: "command", command: curlCommand(apiBaseUrl, hook) },
            timeout: hook.timeout ?? DEFAULT_HOOK_TIMEOUT_SECONDS,
          },
        ],
  );

  const existing = readJsonRecord(file);
  const existingHooks = Array.isArray(existing?.hooks) ? existing.hooks : [];
  const nextNames = new Set(nextHooks.map((hook) => hook.name));

  // Keep the user's own hooks; replace ours so a changed API URL does not leave stale copies behind.
  const keptHooks = existingHooks.filter((hook) => {
    const name = asRecord(hook)?.name;

    return !isString(name) || (!nextNames.has(name) && name !== LEGACY_POST_TOOL_USE_NAME);
  });

  writeJsonFile(file, { version: "v1", hooks: [...keptHooks, ...nextHooks] });
};

/**
 * Exported for tests: the OpenCode plugin source Adadex writes for a given API URL.
 * It posts the same payload shape the Claude Code hooks send, so the API reads one format.
 */
export const renderOpenCodePlugin = (
  apiBaseUrl: string,
) => `// Written by Adadex. Reports this OpenCode session to the Adadex deck.
// It does nothing unless Adadex started OpenCode (ADADEX_SESSION_ID is set). Adadex rewrites this file.
const API_BASE_URL = ${JSON.stringify(apiBaseUrl)};
const ADADEX_SESSION_ID = process.env.ADADEX_SESSION_ID ?? "";
// OpenCode tool names the API knows under their Claude Code name.
const CANONICAL_TOOL_NAMES: Record<string, string> = { question: "AskUserQuestion" };

const post = (path: string, body: Record<string, unknown>) => {
  const url = \`\${API_BASE_URL}\${path}?adadex_session=\${encodeURIComponent(ADADEX_SESSION_ID)}\`;

  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  }).catch(() => {});
};

export default {
  id: "adadex",
  setup(ctx: any) {
    if (ADADEX_SESSION_ID === "") return;

    const cwd: string = ctx.location?.directory ?? process.cwd();
    // Subagent sessions belong to the terminal's main session; reporting them would end its turn early.
    const childSessions = new Set<string>();

    ctx.tool.hook("execute.before", (call: any) => {
      if (childSessions.has(call.sessionID)) return;
      post("/api/hooks/pre-tool-use", {
        session_id: call.sessionID,
        cwd,
        tool_name: CANONICAL_TOOL_NAMES[call.tool] ?? call.tool,
      });
    });

    ctx.event.subscribe((event: any) => {
      const data = event?.data ?? event?.properties ?? {};
      const sessionID = data.sessionID;

      if (event?.type === "session.created" && typeof data.parentID === "string") {
        childSessions.add(sessionID);
      }

      if (childSessions.has(sessionID)) return;

      switch (event?.type) {
        case "session.created":
          post("/api/hooks/session-start", { session_id: sessionID, cwd });

          return;
        case "session.execution.started":
          post("/api/hooks/user-prompt-submit", { session_id: sessionID, cwd });

          return;
        case "permission.asked":
          post("/api/hooks/notification", {
            session_id: sessionID,
            cwd,
            notification_type: "permission_prompt",
          });

          return;
        case "session.idle":
          post("/api/hooks/stop", { session_id: sessionID, cwd });

          return;
      }
    });
  },
};
`;

const installOpenCodePlugin = (targetCwd: string, apiBaseUrl: string) => {
  writeIfChanged(
    join(targetCwd, ".opencode", "plugins", "adadex.ts"),
    renderOpenCodePlugin(apiBaseUrl),
  );
};

const INSTALLERS: Record<TerminalAgentProvider, (targetCwd: string, apiBaseUrl: string) => void> = {
  claude: installClaudeHooks,
  opencode: installOpenCodePlugin,
  kiro: installKiroHooks,
};

/** Throws on I/O failure; the caller decides whether a failed install matters. */
export const installAgentHooks = (
  targetCwd: string,
  agentProvider: TerminalAgentProvider,
  apiBaseUrl: string,
) => {
  INSTALLERS[agentProvider](targetCwd, apiBaseUrl);
};
