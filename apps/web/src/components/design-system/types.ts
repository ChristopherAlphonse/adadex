export type AgentStatus = "running" | "stopped" | "stale" | "idle";

export type Agent = {
  id: string;
  name: string;
  status: AgentStatus;
  branch: string;
  worktree: string;
  commit: string;
  tokens: string;
  cpu: number;
  mem: string;
  uptime: string;
  x: number;
  y: number;
};

export type LogLevel = "info" | "warn" | "error" | "ok";

export type LogLine = {
  t: string;
  level: LogLevel;
  msg: string;
};
