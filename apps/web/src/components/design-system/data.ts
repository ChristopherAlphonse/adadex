import {
  EyeOff,
  GitBranch,
  Maximize2,
  Network,
  RefreshCw,
  Settings2,
  TerminalSquare,
} from "lucide-react";

import type { Agent, LogLine } from "./types";

export const DEMO_AGENTS: Agent[] = [
  {
    id: "deck-lead",
    name: "Deck Lead",
    status: "running",
    branch: "main",
    worktree: "~/dev/adadex/core",
    commit: "a7f29d1",
    tokens: "142.4k / 500k",
    cpu: 42,
    mem: "1.8 GB / 4.0 GB",
    uptime: "14h 22m",
    x: 50,
    y: 50,
  },
  {
    id: "t1",
    name: "Terminal 1",
    status: "idle",
    branch: "feat/router",
    worktree: "~/dev/adadex/t1",
    commit: "c91ee02",
    tokens: "2.1k / 50k",
    cpu: 1,
    mem: "120 MB / 1.0 GB",
    uptime: "00h 04m",
    x: 78,
    y: 28,
  },
  {
    id: "t2",
    name: "Terminal 2",
    status: "stopped",
    branch: "fix/race-cond",
    worktree: "~/dev/adadex/t2",
    commit: "1b88a40",
    tokens: "18.9k / 50k",
    cpu: 0,
    mem: "0 MB",
    uptime: "—",
    x: 22,
    y: 46,
  },
  {
    id: "t6",
    name: "Terminal 6",
    status: "stale",
    branch: "exp/dispatch",
    worktree: "~/dev/adadex/t6",
    commit: "9ee127c",
    tokens: "8.4k / 50k",
    cpu: 0,
    mem: "240 MB",
    uptime: "02h 41m",
    x: 72,
    y: 78,
  },
];

export const CONSOLE_NAV = [
  { n: 1, label: "Agents" },
  { n: 2, label: "Deck" },
  { n: 3, label: "Activity" },
  { n: 4, label: "Code Intel" },
  { n: 5, label: "Monitor" },
  { n: 6, label: "Conversations" },
  { n: 7, label: "Prompts" },
  { n: 8, label: "Settings" },
] as const;

export const CONSOLE_TOOLBAR = [
  { label: "Terminal", key: "T", icon: TerminalSquare },
  { label: "Worktree", key: "W", icon: GitBranch },
  { label: "Orchestration", key: "O", icon: Network },
  { label: "Fit", key: "F", icon: Maximize2 },
  { label: "Refresh", key: "R", icon: RefreshCw },
  { label: "Hide Idle", key: "H", icon: EyeOff },
  { label: "Setup", key: "S", icon: Settings2 },
] as const;

export const DEMO_LOGS: LogLine[] = [
  { t: "08:21:04", level: "info", msg: "Initializing kernel..." },
  { t: "08:21:05", level: "info", msg: "Socket established at port 9021" },
  { t: "08:21:06", level: "info", msg: "Loading weights from v2_checkpoint" },
  { t: "08:21:08", level: "warn", msg: "Latency spiked to 240ms" },
  { t: "08:21:09", level: "info", msg: "Node deck-lead handshaking terminal-1" },
  { t: "08:21:12", level: "error", msg: "Terminal 6 connection reset (EPIPE)" },
  { t: "08:21:13", level: "info", msg: "Retry scheduled in 2.0s" },
  { t: "08:21:15", level: "ok", msg: "Reconnected — stream synced (rev 1841)" },
];
