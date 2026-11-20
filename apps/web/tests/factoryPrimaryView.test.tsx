import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FactoryPrimaryView } from "../src/components/factory/FactoryPrimaryView";
import { createFakeFactoryHost } from "./test-utils/fakeFactoryHost";

const job = {
  id: "demo",
  title: "Demo job",
  workflowId: "factory",
  stage: "ship",
  round: 1,
  roundLimit: 3,
  commit: null,
};

const workflow = {
  id: "factory",
  name: "Factory",
  stages: [{ id: "ship", moves: [{ to: "ready" }] }],
};

afterEach(() => {
  cleanup();
});

describe("Factory primary view", () => {
  it("renders jobs, approvals and processes from the host", async () => {
    const host = createFakeFactoryHost({
      listJobs: vi.fn(async () => [job]),
      listWorkflows: vi.fn(async () => [workflow]),
      listApprovals: vi.fn(async () => [
        { approvalId: "approval-1", actionId: "job.advance", reason: "May we move?" },
      ]),
      listProcesses: vi.fn(async () => [
        {
          processId: "p-1",
          label: "claude -p",
          startedAt: "2026-11-19T12:00:00.000Z",
        },
      ]),
    });

    render(<FactoryPrimaryView host={host} />);

    expect(await screen.findByLabelText("Job Demo job")).toBeInTheDocument();
    expect(screen.getByLabelText("Stage ship")).toBeInTheDocument();
    expect(screen.getByText("May we move?")).toBeInTheDocument();
    expect(document.querySelector("time")).not.toBeNull();
    expect(screen.getByLabelText("Processes")).toBeInTheDocument();
  });

  it("routes board buttons, approval answers and kills through the host", async () => {
    const host = createFakeFactoryHost({
      listJobs: vi.fn(async () => [job]),
      listWorkflows: vi.fn(async () => [workflow]),
      listApprovals: vi.fn(async () => [
        { approvalId: "approval-1", actionId: "job.advance", reason: "May we move?" },
      ]),
      listProcesses: vi.fn(async () => [
        {
          processId: "p-1",
          label: "claude -p",
          startedAt: "2026-11-19T12:00:00.000Z",
        },
      ]),
    });

    render(<FactoryPrimaryView host={host} />);
    await screen.findByLabelText("Job Demo job");

    fireEvent.click(screen.getByLabelText("Commit locally for Demo job"));
    expect(host.runAction).toHaveBeenCalledWith("job.commit_local", { id: "demo" });

    fireEvent.click(screen.getByLabelText("Approve job.advance"));
    expect(host.respondApproval).toHaveBeenCalledWith("approval-1", true);

    fireEvent.click(screen.getByLabelText("Decline job.advance"));
    expect(host.respondApproval).toHaveBeenCalledWith("approval-1", false);

    fireEvent.click(screen.getByLabelText("Kill process claude -p"));
    expect(host.killProcess).toHaveBeenCalledWith("p-1");
  });

  it("shows the unattended loop toggle only when the host has a loop", async () => {
    const host = createFakeFactoryHost({ getLoop: vi.fn(async () => false) });

    render(<FactoryPrimaryView host={host} />);
    const toggle = await screen.findByRole("button", { name: "Unattended loop: Off" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(toggle);
    expect(host.setLoop).toHaveBeenCalledWith(true);

    cleanup();
    render(<FactoryPrimaryView host={createFakeFactoryHost()} />);
    await screen.findByLabelText("Factory board");
    expect(screen.queryByRole("button", { name: /Unattended loop/ })).toBeNull();
  });

  it("shows host failures without losing the board", async () => {
    const host = createFakeFactoryHost({
      listApprovals: vi.fn(async () => {
        throw new Error("host is busy");
      }),
    });

    render(<FactoryPrimaryView host={host} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("host is busy");
    expect(screen.getByLabelText("Factory board")).toBeInTheDocument();
  });

  it("keeps a refused action's reason on screen after the host event that follows it", async () => {
    let notify: () => void = () => undefined;
    const host = createFakeFactoryHost({
      listJobs: vi.fn(async () => [job]),
      listWorkflows: vi.fn(async () => [workflow]),
      runAction: vi.fn(async () => {
        notify();
        throw new Error("shape.md is not READY");
      }),
      subscribe: vi.fn((onChange: () => void) => {
        notify = onChange;
        return () => undefined;
      }),
    });

    render(<FactoryPrimaryView host={host} />);
    fireEvent.click(await screen.findByLabelText("Move to ready for Demo job"));

    expect(await screen.findByRole("alert")).toHaveTextContent("shape.md is not READY");
    await waitFor(() => expect(host.listJobs).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("alert")).toHaveTextContent("shape.md is not READY");
  });

  it("tells the operator when no desktop host is injected", async () => {
    render(<FactoryPrimaryView host={createFakeFactoryHost({ isAvailable: () => false })} />);

    expect(await screen.findByRole("status")).toHaveTextContent("Factory host is not connected");
  });
});
