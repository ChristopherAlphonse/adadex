import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { WorkspaceSetupSnapshot } from "@adadex/core";

import { App } from "../src/App";
import { jsonResponse, notFoundResponse, resetAppTestHarness } from "./test-utils/appTestHarness";

const buildSetupSnapshot = (
  overrides: Partial<WorkspaceSetupSnapshot> = {},
): WorkspaceSetupSnapshot => ({
  isFirstRun: true,
  shouldShowSetupCard: true,
  hasAnyCoordinations: false,
  coordinationCount: 0,
  steps: [
    {
      id: "initialize-workspace",
      title: "Initialize workspace",
      description: "Create Adadex project files and runtime directories.",
      complete: false,
      required: true,
      actionLabel: "Initialize workspace",
      statusText: "Create .adadex project files before continuing.",
      guidance: "Workspace initialization failed. Run the Adadex initializer in this repository.",
      command: "adadex init",
    },
    {
      id: "ensure-gitignore",
      title: "Ignore local planning files",
      description:
        "Add .adadex/ and .planning/ to .gitignore, or create .gitignore when it is missing.",
      complete: false,
      required: true,
      actionLabel: "Update .gitignore",
      statusText: "Add .adadex/ and .planning/ to .gitignore before creating coordinations.",
      guidance:
        "Git ignore entries are missing. Create or update .gitignore with the Adadex workspace and planning paths.",
      command: "printf '.adadex/\\n.planning/\\n' >> .gitignore",
    },
    {
      id: "check-codex",
      title: "Check Codex",
      description: "Verify the Codex CLI workflow is available on this machine.",
      complete: true,
      required: false,
      actionLabel: "Check Codex",
      statusText: "Codex is available.",
      guidance: null,
      command: null,
    },
    {
      id: "check-git",
      title: "Check Git",
      description: "Verify Git is available for worktree-backed coordinations.",
      complete: true,
      required: false,
      actionLabel: "Check Git",
      statusText: "Git is available.",
      guidance: null,
      command: null,
    },
    {
      id: "check-curl",
      title: "Check curl",
      description: "Verify curl is available for agent hook callbacks.",
      complete: true,
      required: false,
      actionLabel: "Check curl",
      statusText: "curl is available.",
      guidance: null,
      command: null,
    },
    {
      id: "create-coordinations",
      title: "Create coordinations",
      description: "Create at least one coordination before launching a coding agent.",
      complete: false,
      required: true,
      actionLabel: null,
      statusText: "Create your first coordination to continue.",
      guidance: "Use the planner or manual creation to add at least one coordination.",
      command: null,
    },
  ],
  ...overrides,
});

const mockAppRequests = (
  resolveSetup: () => WorkspaceSetupSnapshot,
  options: {
    onEnsureGitignoreStep?: () => WorkspaceSetupSnapshot;
  } = {},
) => {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (url.endsWith("/api/terminal-snapshots") && method === "GET") {
      return jsonResponse([]);
    }

    if (url.endsWith("/api/deck/coordinations") && method === "GET") {
      return jsonResponse([]);
    }

    if (url.endsWith("/api/setup") && method === "GET") {
      return jsonResponse(resolveSetup());
    }

    if (url.endsWith("/api/setup/steps/ensure-gitignore") && method === "POST") {
      return jsonResponse(
        options.onEnsureGitignoreStep ? options.onEnsureGitignoreStep() : resolveSetup(),
      );
    }

    if (url.endsWith("/api/codex/usage") && method === "GET") {
      return jsonResponse({
        status: "unavailable",
        source: "none",
        fetchedAt: "2026-02-27T12:00:00.000Z",
      });
    }

    if (url.endsWith("/api/github/summary") && method === "GET") {
      return jsonResponse({
        status: "unavailable",
        source: "none",
        fetchedAt: "2026-02-27T12:00:00.000Z",
        commitsPerDay: [],
      });
    }

    if (url.includes("/api/analytics/usage-heatmap") && method === "GET") {
      return jsonResponse({
        days: [],
        projects: [],
        models: [],
      });
    }

    if (url.endsWith("/api/ui-state") && method === "GET") {
      return jsonResponse({});
    }

    if (url.endsWith("/api/ui-state") && method === "PATCH") {
      return jsonResponse({});
    }

    return notFoundResponse();
  });
};

describe("App workspace setup", () => {
  afterEach(() => {
    cleanup();
    resetAppTestHarness();
  });

  it("shows the setup card inside the normal Agents view on a fresh workspace", async () => {
    const currentSetup = buildSetupSnapshot();
    mockAppRequests(() => currentSetup);

    render(<App />);

    expect(await screen.findByLabelText("Workspace setup")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeInTheDocument();
    expect(screen.getByLabelText("Main content canvas")).toBeInTheDocument();
    expect(screen.getByLabelText("Canvas graph view")).toBeInTheDocument();
    expect(screen.getByLabelText("Runtime status strip")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "[1] Agents",
      }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("only marks a setup step complete after the refreshed server snapshot says it is done", async () => {
    let currentSetup = buildSetupSnapshot();
    mockAppRequests(() => currentSetup, {
      onEnsureGitignoreStep: () => {
        currentSetup = buildSetupSnapshot({
          steps: buildSetupSnapshot().steps.map((step) =>
            step.id === "ensure-gitignore"
              ? {
                  ...step,
                  complete: true,
                  statusText: ".gitignore covers .adadex.",
                  guidance: null,
                  command: null,
                }
              : step,
          ),
        });
        return currentSetup;
      },
    });

    render(<App />);

    const setupCard = await screen.findByLabelText("Workspace setup");
    fireEvent.click(within(setupCard).getByRole("button", { name: "Update .gitignore" }));

    await waitFor(() => {
      const gitignoreStep = screen.getByText("Ignore .adadex").closest(".workspace-setup-step");
      expect(gitignoreStep).not.toBeNull();
      expect(within(gitignoreStep as HTMLElement).getByText("Done")).toBeInTheDocument();
    });
  });
});
