import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import {
  AGENT_LAUNCH_OPTIONS_STORAGE_KEY,
  launchSettingsToRequest,
  readAgentLaunchSettings,
  writeAgentLaunchSettings,
} from "../src/app/agentLaunchOptions";
import { ActionCards } from "../src/components/deck/ActionCards";

const memory = new Map<string, string>();

beforeEach(() => {
  memory.clear();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
    },
  });
});

const cards = (agent: "claude" | "kiro") => (
  <ActionCards
    agentMenuOpen={false}
    agentMenuRef={{ current: null }}
    onAdd={() => {}}
    onLaunchAgent={() => {}}
    selectedAgent={agent}
    setAgentMenuOpen={() => {}}
    setSelectedAgent={() => {}}
  />
);

describe("agent launch settings", () => {
  it("round-trips and drops values that are not safe flag values", () => {
    writeAgentLaunchSettings({ model: "claude-opus-5-5", effort: "high" });
    expect(readAgentLaunchSettings()).toEqual({ model: "claude-opus-5-5", effort: "high" });

    window.localStorage.setItem(
      AGENT_LAUNCH_OPTIONS_STORAGE_KEY,
      JSON.stringify({ model: "x; rm -rf /", effort: "low" }),
    );
    expect(readAgentLaunchSettings()).toEqual({ model: "", effort: "low" });
  });

  it("turns settings into request fields, leaving out empty ones", () => {
    expect(launchSettingsToRequest({ model: "", effort: "max" })).toEqual({ agentEffort: "max" });
    expect(launchSettingsToRequest({ model: "", effort: "" })).toEqual({});
  });
});

describe("ActionCards launch fields", () => {
  it("shows model and effort for claude and saves what the user picks", () => {
    render(cards("claude"));

    fireEvent.change(screen.getByLabelText("Model (optional)"), {
      target: { value: "claude-opus-5-5" },
    });
    fireEvent.change(screen.getByLabelText("Effort"), { target: { value: "high" } });

    expect(readAgentLaunchSettings()).toEqual({ model: "claude-opus-5-5", effort: "high" });
  });

  it("hides them for agents that launch bare", () => {
    render(cards("kiro"));
    expect(screen.queryByLabelText("Effort")).toBeNull();
  });
});
