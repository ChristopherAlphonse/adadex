import { describe, expect, it } from "vitest";

import { AgentStateTracker } from "../src/agentStateDetection";

describe("AgentStateTracker", () => {
  it("defaults to idle", () => {
    const tracker = new AgentStateTracker();

    expect(tracker.currentState).toBe("idle");
  });

  it("switches to processing when interrupt marker appears", () => {
    const tracker = new AgentStateTracker({ idleAfterMs: 1_000 });

    expect(tracker.observeChunk("running... (3s • esc to interrupt)", 0)).toBe("processing");
    expect(tracker.currentState).toBe("processing");
  });

  it("detects markers split across multiple stdout chunks", () => {
    const tracker = new AgentStateTracker({ idleAfterMs: 1_000 });

    expect(tracker.observeChunk("working... esc to inter", 0)).toBeNull();
    expect(tracker.observeChunk("rupt", 25)).toBe("processing");
  });

  it("ignores ANSI control sequences around processing marker", () => {
    const tracker = new AgentStateTracker({ idleAfterMs: 1_000 });

    const chunk = "\u001b[2K\u001b[1A\rWorking... \u001b[2mesc to interrupt\u001b[0m\n";

    expect(tracker.observeChunk(chunk, 0)).toBe("processing");
  });

  it("forces processing on submit and returns idle after inactivity", () => {
    const tracker = new AgentStateTracker({ idleAfterMs: 1_000 });

    expect(tracker.observeSubmit(0)).toBe("processing");
    expect(tracker.poll(900)).toBeNull();
    expect(tracker.currentState).toBe("processing");

    expect(tracker.poll(1_000)).toBe("idle");
    expect(tracker.currentState).toBe("idle");
  });

  it("extends processing while output is still streaming", () => {
    const tracker = new AgentStateTracker({ idleAfterMs: 1_000 });

    tracker.observeSubmit(0);
    expect(tracker.observeChunk("Once upon a time...", 700)).toBeNull();

    expect(tracker.poll(1_500)).toBeNull();
    expect(tracker.currentState).toBe("processing");

    expect(tracker.poll(1_700)).toBe("idle");
    expect(tracker.currentState).toBe("idle");
  });

  it("does not treat codex title/footer text as idle while processing", () => {
    const tracker = new AgentStateTracker({ idleAfterMs: 1_000 });

    tracker.observeSubmit(0);

    expect(tracker.observeChunk("OpenAI Codex\n100% context left\n", 100)).toBeNull();
    expect(tracker.currentState).toBe("processing");
    expect(tracker.poll(1_050)).toBeNull();
  });
});
