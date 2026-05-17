import { cpSync, existsSync as fsExistsSync, mkdirSync, readdirSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";

import { WORKSPACE_RUNTIME_DIR } from "@adadex/core";
import { createCodeIntelStore } from "./codeIntelStore";
import { readCodexUsageSnapshot as readCodexUsageSnapshotDefault } from "./codexUsage";
import { createApiRequestHandler } from "./createApiServer/requestHandler";
import type { CreateApiServerOptions } from "./createApiServer/types";
import { createUpgradeHandler } from "./createApiServer/upgradeHandler";
import { readGithubRepoSummary as readGithubRepoSummaryDefault } from "./githubRepoSummary";
import { createMonitorService } from "./monitor";
import { migrateLegacyWorkspaceLayout } from "./projectPersistence";
import { createTerminalRuntime } from "./terminalRuntime";
import { scanUsageHeatmap as scanUsageHeatmapDefault } from "./usageHeatmapScanner";

export const createApiServer = ({
  workspaceCwd,
  projectStateDir,
  promptsDir,
  webDistDir,
  apiBaseUrl,
  gitClient,
  readCodexUsageSnapshot = readCodexUsageSnapshotDefault,
  readGithubRepoSummary,
  scanUsageHeatmap,
  monitorService,
  allowRemoteAccess = false,
}: CreateApiServerOptions = {}) => {
  const resolvedWorkspaceCwd = workspaceCwd ?? process.cwd();
  migrateLegacyWorkspaceLayout(resolvedWorkspaceCwd);
  // State lives in ~/.adadex/projects/<name>/ when provided, else falls back to <project>/.adadex/
  const resolvedStateDir = projectStateDir ?? join(resolvedWorkspaceCwd, WORKSPACE_RUNTIME_DIR);
  let resolvedApiBaseUrl = apiBaseUrl ?? "http://127.0.0.1:8787";
  const getApiBaseUrl = () => resolvedApiBaseUrl;
  const getApiPort = () => {
    try {
      return String(new URL(resolvedApiBaseUrl).port || 80);
    } catch {
      return "8787";
    }
  };
  const resolvedUserPromptsDir = join(resolvedStateDir, "prompts");
  const resolvedCorePromptsDir = join(resolvedStateDir, "prompts", "core");

  // Sync builtin prompts into the project state dir on every start so prompt
  // changes in the repo take effect without requiring manual cache cleanup.
  const sourceDir = promptsDir ?? join(resolvedWorkspaceCwd, "prompts");
  if (fsExistsSync(sourceDir)) {
    mkdirSync(resolvedCorePromptsDir, { recursive: true });
    for (const file of readdirSync(sourceDir)) {
      if (file.endsWith(".md")) {
        cpSync(join(sourceDir, file), join(resolvedCorePromptsDir, file));
      }
    }
  }

  // Read builtin prompts from the live source directory when available so new
  // prompt files and prompt edits take effect without restarting the API.
  // Keep the mirrored state copy as a fallback for packaged/runtime setups
  // where the source prompts directory is unavailable.
  const resolvedPromptsDir = fsExistsSync(sourceDir) ? sourceDir : resolvedCorePromptsDir;
  const readGithubRepoSummaryWithDefault =
    readGithubRepoSummary ??
    (() =>
      readGithubRepoSummaryDefault({
        cwd: resolvedWorkspaceCwd,
      }));

  const runtimeOptions: Parameters<typeof createTerminalRuntime>[0] = {
    workspaceCwd: resolvedWorkspaceCwd,
    projectStateDir: resolvedStateDir,
    getApiBaseUrl,
  };
  if (gitClient) {
    runtimeOptions.gitClient = gitClient;
  }

  const runtime = createTerminalRuntime(runtimeOptions);
  const monitorServiceWithDefault =
    monitorService ??
    createMonitorService({
      projectStateDir: resolvedStateDir,
    });
  const scanUsageHeatmapWithDefault =
    scanUsageHeatmap ??
    ((scope: "all" | "project") => scanUsageHeatmapDefault(scope, resolvedWorkspaceCwd));

  const codeIntelStore = createCodeIntelStore(resolvedStateDir);

  const requestHandler = createApiRequestHandler({
    runtime,
    workspaceCwd: resolvedWorkspaceCwd,
    projectStateDir: resolvedStateDir,
    promptsDir: resolvedPromptsDir,
    userPromptsDir: resolvedUserPromptsDir,
    webDistDir,
    getApiBaseUrl,
    getApiPort,
    readCodexUsageSnapshot,
    readGithubRepoSummary: readGithubRepoSummaryWithDefault,
    scanUsageHeatmap: scanUsageHeatmapWithDefault,
    monitorService: monitorServiceWithDefault,
    codeIntelStore,
    allowRemoteAccess,
  });

  const server = createServer(requestHandler);

  server.on(
    "upgrade",
    createUpgradeHandler({
      runtime,
      allowRemoteAccess,
    }),
  );

  return {
    server,
    async start(port = 8787, host = "127.0.0.1") {
      await new Promise<void>((resolveStart, rejectStart) => {
        server.listen(port, host, () => resolveStart());
        server.once("error", rejectStart);
      });

      const address = server.address();
      const resolvedPort = typeof address === "object" && address ? address.port : port;
      resolvedApiBaseUrl = `http://${host}:${resolvedPort}`;

      return { host, port: resolvedPort };
    },
    async stop() {
      await runtime.close();
      await new Promise<void>((resolveStop, rejectStop) => {
        server.close((error) => {
          if (error) {
            rejectStop(error);
            return;
          }
          resolveStop();
        });
        server.closeAllConnections();
      });
    },
  };
};
