import { afterEach, describe, expect, it, vi } from "vitest";

import { isVerboseLoggingEnabled, logVerbose } from "../src/logging";

describe("logging", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("keeps verbose logs disabled by default", () => {
    vi.stubEnv("OCTOGENT_VERBOSE_LOGS", undefined);

    expect(isVerboseLoggingEnabled()).toBe(false);
  });

  it("enables verbose logs when OCTOGENT_VERBOSE_LOGS=1", () => {
    vi.stubEnv("OCTOGENT_VERBOSE_LOGS", "1");

    expect(isVerboseLoggingEnabled()).toBe(true);
  });

  it("only writes verbose logs when enabled", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    logVerbose("hidden");
    vi.stubEnv("OCTOGENT_VERBOSE_LOGS", "1");
    logVerbose("shown");

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith("shown");
  });
});
