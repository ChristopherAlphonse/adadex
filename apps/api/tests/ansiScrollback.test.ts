import { describe, expect, it } from "vitest";

import { stripBrokenLeadingAnsi } from "../src/terminalRuntime/ansiScrollback";

describe("stripBrokenLeadingAnsi", () => {
  it("passes through text with no ANSI fragment", () => {
    expect(stripBrokenLeadingAnsi("hello world\r\n")).toBe("hello world\r\n");
  });

  it("keeps a complete leading escape sequence intact", () => {
    const input = "\u001b[31mred text";
    expect(stripBrokenLeadingAnsi(input)).toBe(input);
  });

  it("strips a broken OSC tail terminated by BEL", () => {
    // Scrollback trimming can drop the leading ESC of "\x1b]0;title\x07rest",
    // leaving "]0;title\x07rest" — the bare OSC tail must be stripped.
    const bel = String.fromCharCode(0x07);
    const input = `]0;title${bel}rest of line`;
    expect(stripBrokenLeadingAnsi(input)).toBe("rest of line");
  });

  it("strips a broken OSC tail terminated by ST (ESC \\)", () => {
    const esc = String.fromCharCode(0x1b);
    const input = `]0;title${esc}\\rest of line`;
    expect(stripBrokenLeadingAnsi(input)).toBe("rest of line");
  });

  it("strips a broken CSI tail", () => {
    // Bare "[31m" fragment left behind after the leading ESC byte was trimmed.
    expect(stripBrokenLeadingAnsi("[31mred text")).toBe("red text");
  });

  it("strips a broken, parameterized orphaned CSI tail", () => {
    expect(stripBrokenLeadingAnsi("1;31mred text")).toBe("red text");
  });

  it("strips consecutive broken fragments", () => {
    const bel = String.fromCharCode(0x07);
    const input = `]0;title${bel}[31mred text`;
    expect(stripBrokenLeadingAnsi(input)).toBe("red text");
  });

  it("returns empty string unchanged", () => {
    expect(stripBrokenLeadingAnsi("")).toBe("");
  });
});
