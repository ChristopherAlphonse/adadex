import type { TerminalSnapshot } from "@adadex/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ThreadTree } from "../src/components/ThreadTree";

const terminal = (id: string, extra: Partial<TerminalSnapshot> = {}): TerminalSnapshot => ({
  terminalId: id,
  label: `Agent ${id}`,
  state: "live",
  coordinationId: "c",
  createdAt: "2026-11-22T00:00:00.000Z",
  ...extra,
});

const now = Date.parse("2026-11-22T00:09:00.000Z");

describe("ThreadTree", () => {
  it("shows children under their parent with status and age, and counts who needs you", () => {
    render(
      <ThreadTree
        now={now}
        terminals={[
          terminal("p"),
          terminal("w1", { parentTerminalId: "p", agentRuntimeState: "waiting_for_user" }),
          terminal("w2", { parentTerminalId: "p", agentRuntimeState: "processing" }),
        ]}
      />,
    );

    expect(screen.getByText("Agent p")).toBeTruthy();
    expect(screen.getByText("Needs you")).toBeTruthy();
    expect(screen.getByText("Working")).toBeTruthy();
    expect(screen.getByText("1 need you")).toBeTruthy();
    expect(screen.getAllByText("9m").length).toBeGreaterThan(0);
  });

  it("renders nothing when there are no terminals", () => {
    const { container } = render(<ThreadTree now={now} terminals={[]} />);

    expect(container.firstChild).toBeNull();
  });
});
