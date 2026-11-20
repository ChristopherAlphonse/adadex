import { spawn } from "node:child_process";

import type { AgentChild, SpawnAgent } from "./claudeCodeProvider";

/** Starts the agent in its own process group, so killing it also kills the tools it started. */
export const spawnAgent: SpawnAgent = (command, args, cwd): AgentChild => {
  const child = spawn(command, [...args], {
    cwd,
    detached: true,
    stdio: ["ignore", "pipe", "ignore"],
  });
  return {
    stdout: child.stdout,
    onExit: (cb) => child.on("close", (code) => cb(code)),
    kill: () => {
      if (child.pid === undefined) return;
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {}
    },
  };
};
