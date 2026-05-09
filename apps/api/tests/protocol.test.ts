import type { IncomingMessage } from "node:http";
import { describe, expect, it } from "vitest";

import { getTerminalId } from "../src/terminalRuntime/protocol";

describe("getTerminalId", () => {
  it("returns null for malformed percent-encoding in terminal id", () => {
    const request = {
      url: "/api/terminals/%E0%A4%A/ws",
    } as IncomingMessage;

    expect(getTerminalId(request)).toBeNull();
  });
});
