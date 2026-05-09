import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { homedir } from "node:os";
import { join } from "node:path";

const DEFAULT_START_PORT = 8787;
const MAX_PORT_ATTEMPTS = 200;

const parseStartPort = (value) => {
  if (!value) {
    return DEFAULT_START_PORT;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    return DEFAULT_START_PORT;
  }

  return parsed;
};

const isPortInUseError = (error) =>
  Boolean(error) &&
  typeof error === "object" &&
  "code" in error &&
  (error.code === "EADDRINUSE" || error.code === "EACCES");

const canListenOnPort = (port) =>
  new Promise((resolve) => {
    const probeServer = createServer();

    const closeAndResolve = (result) => {
      probeServer.removeAllListeners();
      probeServer.close(() => {
        resolve(result);
      });
    };

    probeServer.once("error", (error) => {
      if (isPortInUseError(error)) {
        resolve(false);
        return;
      }

      resolve(false);
    });

    probeServer.once("listening", () => {
      closeAndResolve(true);
    });

    probeServer.listen(port, "127.0.0.1");
  });

const findOpenPort = async (startPort) => {
  for (let offset = 0; offset < MAX_PORT_ATTEMPTS; offset += 1) {
    const port = startPort + offset;
    if (port > 65535) {
      break;
    }

    // eslint-disable-next-line no-await-in-loop
    const isAvailable = await canListenOnPort(port);
    if (isAvailable) {
      return port;
    }
  }

  throw new Error(`Unable to find an open port starting from ${startPort}`);
};

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const startPort = parseStartPort(
  process.env.ADADEX_DEV_START_PORT ?? process.env.OCTOGENT_DEV_START_PORT,
);
const apiPort = await findOpenPort(startPort);
const apiOrigin = `http://127.0.0.1:${apiPort}`;

console.log(`[adadex-dev] using api port ${apiPort}`);

const monorepoRoot = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

// Resolve project state dir from global registry.
const resolveProjectStateDir = (workspaceCwd) => {
  if (process.env.ADADEX_PROJECT_STATE_DIR) {
    return process.env.ADADEX_PROJECT_STATE_DIR;
  }
  if (process.env.OCTOGENT_PROJECT_STATE_DIR) {
    return process.env.OCTOGENT_PROJECT_STATE_DIR;
  }
  const projectConfigPathNew = join(workspaceCwd, ".adadex", "project.json");
  const projectConfigPathLegacy = join(workspaceCwd, ".octogent", "project.json");
  const projectConfigPath = existsSync(projectConfigPathNew)
    ? projectConfigPathNew
    : projectConfigPathLegacy;
  if (existsSync(projectConfigPath)) {
    try {
      const projectConfig = JSON.parse(readFileSync(projectConfigPath, "utf-8"));
      if (
        typeof projectConfig.projectId === "string" &&
        projectConfig.projectId.trim().length > 0
      ) {
        return join(homedir(), ".adadex", "projects", projectConfig.projectId);
      }
    } catch {
      // fall through
    }
  }
  const projectsFileNew = join(homedir(), ".adadex", "projects.json");
  const projectsFileLegacy = join(homedir(), ".octogent", "projects.json");
  const projectsFile = existsSync(projectsFileNew) ? projectsFileNew : projectsFileLegacy;
  if (existsSync(projectsFile)) {
    try {
      const registry = JSON.parse(readFileSync(projectsFile, "utf-8"));
      const project = registry.projects?.find((p) => p.path === workspaceCwd);
      if (project) {
        if (typeof project.id === "string" && project.id.trim().length > 0) {
          const base = projectsFile.includes(".adadex")
            ? join(homedir(), ".adadex")
            : join(homedir(), ".octogent");
          return join(base, "projects", project.id);
        }
        if (typeof project.name === "string" && project.name.trim().length > 0) {
          const base = projectsFile.includes(".adadex")
            ? join(homedir(), ".adadex")
            : join(homedir(), ".octogent");
          return join(base, "projects", project.name);
        }
      }
    } catch {
      // fall through
    }
  }
  return `${workspaceCwd}/.adadex`;
};

const workspaceCwd =
  process.env.ADADEX_WORKSPACE_CWD ?? process.env.OCTOGENT_WORKSPACE_CWD ?? monorepoRoot;
const projectStateDir = resolveProjectStateDir(workspaceCwd);

const child = spawn(
  pnpmCommand,
  ["-r", "--parallel", "--filter", "@adadex/api", "--filter", "@adadex/web", "dev"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      ADADEX_API_PORT: String(apiPort),
      ADADEX_API_ORIGIN: apiOrigin,
      OCTOGENT_API_PORT: String(apiPort),
      OCTOGENT_API_ORIGIN: apiOrigin,
      ADADEX_WORKSPACE_CWD: workspaceCwd,
      OCTOGENT_WORKSPACE_CWD: workspaceCwd,
      ADADEX_PROJECT_STATE_DIR: projectStateDir,
      OCTOGENT_PROJECT_STATE_DIR: projectStateDir,
      ADADEX_PROMPTS_DIR:
        process.env.ADADEX_PROMPTS_DIR ??
        process.env.OCTOGENT_PROMPTS_DIR ??
        `${monorepoRoot}/prompts`,
      OCTOGENT_PROMPTS_DIR:
        process.env.ADADEX_PROMPTS_DIR ??
        process.env.OCTOGENT_PROMPTS_DIR ??
        `${monorepoRoot}/prompts`,
    },
  },
);

const forwardSignal = (signal) => {
  if (child.killed) {
    return;
  }

  child.kill(signal);
};

process.on("SIGINT", () => forwardSignal("SIGINT"));
process.on("SIGTERM", () => forwardSignal("SIGTERM"));

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
