import { describe, expect, it } from "vitest";

import { isSessionLive } from "../src/app/conversationText";

const events = (...types: string[]) => types.map((type) => ({ type }));

describe("isSessionLive", () => {
  it("is live when the session never ended", () => {
    expect(isSessionLive(events("session_start", "user_prompt", "assistant_message"))).toBe(true);
  });

  it("is ended when the last lifecycle event is an end", () => {
    expect(isSessionLive(events("session_start", "assistant_message", "session_end"))).toBe(false);
  });

  it("is live again when a new run started after an old end", () => {
    expect(
      isSessionLive(events("session_start", "session_end", "session_start", "assistant_message")),
    ).toBe(true);
  });

  it("is live with no lifecycle events at all", () => {
    expect(isSessionLive(events("assistant_message"))).toBe(true);
  });
});
